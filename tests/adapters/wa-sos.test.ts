import { describe, expect, it } from "vitest";
import { classifyWaContest, makeWaSosAdapter, WA_HOST } from "../../src/data/adapters/wa-sos";
import { HOUSE_COUNTIES, stateCountyFips } from "../../src/data/adapters/az-mi-wa-shared";
import { Race } from "../../src/data/schema";
import { getRace } from "../../src/data/reference/load";
import { fixture, fixtureFetch, makeCtx, sumVotes, type Route } from "./helpers";

const API = `${WA_HOST}/results/public/api/elections/washington`;
const metas = ["house:WA-02", "house:WA-06", "house:WA-07", "ballot:WA-parental-right-to-review-education"].map((id) => getRace(id)!);

function detailRoutes(slug: string, tag: string, ids: string[]): Route[] {
  return ids.map((id): Route => [`${API}/${slug}/data/ballot-item/${id}`, fixture(`wa/ballot-item.${tag}.${id}.json`)]);
}

describe("classifyWaContest", () => {
  it("handles general and primary House spellings, statewide measures only", () => {
    expect(classifyWaContest("Congressional District 1 - U.S. Representative", "Candidate")?.id).toBe("house:WA-01");
    expect(classifyWaContest("U.S. Representative - Congressional District 10", "Candidate")?.id).toBe("house:WA-10");
    expect(classifyWaContest("Initiative Measure No. IL26-001", "BallotMeasure")?.id).toBe("ballot:WA-parental-right-to-review-education");
    expect(classifyWaContest("Initiative Measure No. IL26-638", "BallotMeasure")?.id).toBe("ballot:WA-initiative-il26-638");
    expect(classifyWaContest("City of Bothell - Proposition No. 1", "BallotMeasure")).toBeNull();
    expect(classifyWaContest("Legislative District 1 - State Representative Pos. 1", "Candidate")).toBeNull();
    expect(classifyWaContest("Supreme Court - Justice Position #01", "Candidate")).toBeNull();
  });
});

describe("wa-sos 2026 general (staged)", () => {
  const stub = fixtureFetch([
    [`${API}/20261103`, fixture("wa/election.2026.json")],
    [`${API}/20261103/ballot-items`, fixture("wa/ballot-items.2026.json")],
    ...detailRoutes("20261103", "2026", [
      "54c40000-9064-bbec-306c-08df15c0a82a", // WA-02
      "54c40000-9064-bbec-97f2-08df15c0a82a", // WA-07
      "01000000-c099-693d-09a5-08df1b200333", // IL26-001
    ]),
  ]);

  it("builds House + measures with 53xxx county units and preference parties", async () => {
    const ctx = makeCtx(stub, metas);
    const races = await makeWaSosAdapter({ host: WA_HOST, slug: "20261103", electionDate: "2026-11-03" }).fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    expect(races.map((r) => r.id).sort()).toEqual(["ballot:WA-parental-right-to-review-education", "house:WA-02", "house:WA-07"]);

    const h2 = races.find((r) => r.id === "house:WA-02")!;
    expect(h2.source).toMatchObject({ adapter: "wa-sos", tier: "A" });
    expect(h2.units.map((u) => u.fips).sort()).toEqual(HOUSE_COUNTIES["house:WA-02"]);
    expect(h2.candidates.find((c) => c.id === "larsen-rick")?.party).toBe("D");
    expect(h2.candidates.find((c) => c.id === "feller-edwin")?.party).toBe("R");
    expect(h2.status).toBe("not_started");
    expect(h2.source.attribution).not.toMatch(/partial/);

    const m = races.find((r) => r.id === "ballot:WA-parental-right-to-review-education")!;
    expect(m.name).toMatch(/Parental Right/);
    expect(m.units.map((u) => u.fips).sort()).toEqual(stateCountyFips("WA"));
    expect(m.units.find((u) => u.fips === "53033")?.precinctsTotal).toBe(3685);
  });
});

describe("wa-sos 2026 primary (real votes)", () => {
  const stub = fixtureFetch([
    [`${API}/20260804`, fixture("wa/election.primary-2026.json")],
    [`${API}/20260804/ballot-items`, fixture("wa/ballot-items.primary-2026.json")],
    ...detailRoutes("20260804", "primary-2026", [
      "212641ea-7af6-4eda-bb13-d09b73589923", // WA-02
      "de851b07-1fed-4849-8b22-1c75611ad585", // WA-06
    ]),
  ]);

  it("totals equal the county sum; a county with nothing in yet stays outstanding", async () => {
    const ctx = makeCtx(stub, metas);
    const races = await makeWaSosAdapter({ host: WA_HOST, slug: "20260804", electionDate: "2026-08-04" }).fetch(ctx);
    expect(races.map((r) => r.id).sort()).toEqual(["house:WA-02", "house:WA-06"]);
    const h2 = races.find((r) => r.id === "house:WA-02")!;
    expect(h2.totalVotes).toBe(29806 + 6852 + 34347 + 66372 + 72133);
    expect(h2.candidates.find((c) => c.id === "larsen-rick")?.votes).toBeGreaterThan(0);
    for (const r of races) {
      expect(r.totalVotes).toBe(r.units.reduce((s, u) => s + u.totalVotes, 0));
      for (const c of r.candidates) expect(c.votes).toBe(r.units.reduce((s, u) => s + (u.votes[c.id] ?? 0), 0));
      for (const u of r.units) expect(u.totalVotes).toBe(sumVotes(u.votes));
    }
    expect(h2.status).toBe("certified");
    const h6 = races.find((r) => r.id === "house:WA-06")!;
    expect(h6.units.find((u) => u.fips === "53009")).toMatchObject({ totalVotes: 0, precinctsReporting: 0, precinctsTotal: 67, complete: false });
  });
});
