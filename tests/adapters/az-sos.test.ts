import { describe, expect, it } from "vitest";
import { AZ_EV_HOST, classifyAzContest, makeAzSosAdapter } from "../../src/data/adapters/az-sos";
import { HOUSE_COUNTIES, stateCountyFips } from "../../src/data/adapters/az-mi-wa-shared";
import { Race } from "../../src/data/schema";
import { getRace } from "../../src/data/reference/load";
import { fixture, fixtureFetch, makeCtx, sumVotes } from "./helpers";

const API = `${AZ_EV_HOST}/results/public/api/elections/Arizona`;
const GOV = "248c0000-c0a3-7204-3acd-08df11bc03cf";
const HOUSE2 = "248c0000-c0a3-7204-0306-08df11bc03cf";
const PROP141 = "248c0000-c0a3-7204-c77a-08df11bc03d0";
const PRIMARY_GOV_R = "d26840fe-675a-42ac-90f4-6bbe461c55b9";
const metas = ["governor:AZ", "house:AZ-02", "ballot:AZ-prop-141"].map((id) => getRace(id)!);

describe("classifyAzContest", () => {
  it("keeps Governor, US House and statewide props; drops everything else", () => {
    expect(classifyAzContest("Governor and Lieutenant Governor")?.id).toBe("governor:AZ");
    expect(classifyAzContest("U.S. Representative in Congress - District No. 7")?.id).toBe("house:AZ-07");
    expect(classifyAzContest("PROPOSITION 141")?.id).toBe("ballot:AZ-prop-141");
    expect(classifyAzContest("Secretary of State")).toBeNull();
    expect(classifyAzContest("State Senator - District No.  1")).toBeNull();
    expect(classifyAzContest("Shall JOHN LOPEZ IV, Justice of the Supreme Court be retained in office?")).toBeNull();
  });
});

describe("az-sos 2026 general (staged, 0 votes)", () => {
  const stub = fixtureFetch([
    [`${API}/110326GeneralElection`, fixture("az/election.2026.json")],
    [`${API}/110326GeneralElection/ballot-items`, fixture("az/ballot-items.2026.json")],
    [`${API}/110326GeneralElection/data/ballot-item/${GOV}`, fixture(`az/ballot-item.2026.${GOV}.json`)],
    [`${API}/110326GeneralElection/data/ballot-item/${HOUSE2}`, fixture(`az/ballot-item.2026.${HOUSE2}.json`)],
    [`${API}/110326GeneralElection/data/ballot-item/${PROP141}`, fixture(`az/ballot-item.2026.${PROP141}.json`)],
  ]);
  const adapter = makeAzSosAdapter({ jurisdiction: "Arizona", slug: "110326GeneralElection", electionDate: "2026-11-03" });

  it("resolves ids, matches candidates, keys units by AZ county FIPS", async () => {
    const ctx = makeCtx(stub, metas);
    const races = await adapter.fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    // Breakdowns for the other 15 wanted contests 404 in the stub → skipped, never reported from the summary.
    expect(races.map((r) => r.id).sort()).toEqual(["ballot:AZ-prop-141", "governor:AZ", "house:AZ-02"]);
    expect(ctx.logs.some((l) => /breakdown failed .* race skipped/.test(l))).toBe(true);

    const gov = races.find((r) => r.id === "governor:AZ")!;
    expect(gov.source).toMatchObject({ adapter: "az-sos", tier: "A" });
    expect(gov.source.attribution).toMatch(/Arizona Secretary of State/);
    expect(gov.status).toBe("not_started");
    expect(gov.units.map((u) => u.fips).sort()).toEqual(stateCountyFips("AZ"));
    expect(gov.units.every((u) => /^04\d{3}$/.test(u.fips ?? "") && (u.precinctsTotal ?? 0) > 0)).toBe(true);
    const ids = gov.candidates.map((c) => c.id);
    for (const id of ["biggs-andy", "hobbs-katie", "lombardo-risa", "hourihan-teri"]) expect(ids).toContain(id);
    expect(gov.candidates.find((c) => c.id === "hobbs-katie")?.party).toBe("D");
    expect(gov.candidates.find((c) => c.id === "biggs-andy")?.party).toBe("R");
    // Full coverage → race-level precinct totals are the county sum.
    expect(gov.precinctsTotal).toBe(gov.units.reduce((s, u) => s + (u.precinctsTotal ?? 0), 0));

    const h2 = races.find((r) => r.id === "house:AZ-02")!;
    expect(h2.units.map((u) => u.fips)).toEqual(expect.arrayContaining(HOUSE_COUNTIES["house:AZ-02"]!));
    expect(h2.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["crane-eli", "nez-jonathan"]));
    const prop = races.find((r) => r.id === "ballot:AZ-prop-141")!;
    expect(prop.candidates.map((c) => c.id).sort()).toEqual(["no", "yes"]);
    expect(prop.units).toHaveLength(15);
  });
});

describe("az-sos 2026 primary (real votes; the statewide instance carried only 2 counties)", () => {
  const stub = fixtureFetch([
    [`${API}/Primary-07-21-26`, fixture("az/election.primary-2026.json")],
    [`${API}/Primary-07-21-26/ballot-items`, fixture("az/ballot-items.primary-2026.json")],
    [`${API}/Primary-07-21-26/data/ballot-item/${PRIMARY_GOV_R}`, fixture(`az/ballot-item.primary-2026.${PRIMARY_GOV_R}.json`)],
  ]);

  it("sums only the counties present and pads the other 13 as not reporting", async () => {
    const ctx = makeCtx(stub, metas);
    const adapter = makeAzSosAdapter({ jurisdiction: "Arizona", slug: "Primary-07-21-26", electionDate: "2026-07-21" });
    // "Governor (DEM)" etc. also classify as governor:AZ; only the REP breakdown is stubbed.
    const races = await adapter.fetch(ctx);
    const gov = races.find((r) => r.id === "governor:AZ")!;
    expect(() => Race.parse(gov)).not.toThrow();
    expect(gov.totalVotes).toBe(8716 + 34104);
    expect(gov.candidates.find((c) => c.id === "biggs-andy")?.votes).toBe(6210 + 26705);
    expect(gov.totalVotes).toBe(gov.units.reduce((s, u) => s + u.totalVotes, 0));
    for (const c of gov.candidates) expect(c.votes).toBe(gov.units.reduce((s, u) => s + (u.votes[c.id] ?? 0), 0));
    for (const u of gov.units) expect(u.totalVotes).toBe(sumVotes(u.votes));

    expect(gov.units).toHaveLength(15);
    const zero = gov.units.filter((u) => u.totalVotes === 0);
    expect(zero).toHaveLength(13);
    for (const u of zero) {
      expect(u.precinctsReporting).toBe(0);
      expect(u.complete).not.toBe(true);
      expect(u.fips).toMatch(/^04\d{3}$/);
    }
    expect(gov.units.find((u) => u.fips === "04015")).toMatchObject({ totalVotes: 34104, complete: true });
    expect(gov.precinctsTotal).toBeUndefined();
    expect(gov.source.attribution).toMatch(/partial: 2 of 15 counties/);
  });
});
