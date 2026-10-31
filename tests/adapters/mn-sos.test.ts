import { describe, expect, it } from "vitest";
import { makeMnAdapter, mnCountyFips, parseMnLine } from "../../src/data/adapters/mn-sos";
import { Race } from "../../src/data/schema";
import { fixture, fixtureFetch, makeCtx, meta, sumVotes } from "./helpers";

describe("mn-sos", () => {
  it("parses the 16-column precinct line and county fips rule", () => {
    const r = parseMnLine("MN;01;0005;0102;U.S. Senator;;0403;Peggy Flanagan;;;DFL;0;1;0;0.00;0")!;
    expect(r.countyId).toBe("01");
    expect(r.officeId).toBe("0102");
    expect(r.candName).toBe("Peggy Flanagan");
    expect(r.party).toBe("DFL");
    expect(parseMnLine("# comment")).toBeNull();
    expect(mnCountyFips("01")).toBe("27001");
    expect(mnCountyFips("27")).toBe("27053"); // Hennepin
    expect(mnCountyFips("62")).toBe("27123"); // Ramsey
  });

  it("2026 staged: senate, 8 house, governor; parties normalized incl. DFL", async () => {
    const fetchStub = fixtureFetch([["/20261103/allracesbyprecinct.txt", fixture("mn/allracesbyprecinct.2026.truncated.txt")]]);
    const metas = [
      meta({
        id: "senate:MN",
        office: "senate",
        state: "MN",
        name: "MN Senate",
        candidates: [
          { id: "flanagan-peggy", name: "Peggy Flanagan", party: "D", aliases: [] },
          { id: "tafoya-michele", name: "Michele Tafoya", party: "R", aliases: [] },
        ],
      }),
    ];
    const ctx = makeCtx(fetchStub, metas);
    const races = await makeMnAdapter().fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    const ids = races.map((r) => r.id).sort();
    expect(ids).toEqual([
      "governor:MN",
      "house:MN-01", "house:MN-02", "house:MN-03", "house:MN-04",
      "house:MN-05", "house:MN-06", "house:MN-07", "house:MN-08",
      "senate:MN",
    ]);
    const sen = races.find((r) => r.id === "senate:MN")!;
    expect(sen.status).toBe("not_started");
    expect(sen.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["flanagan-peggy", "tafoya-michele", "write-in"]));
    expect(sen.candidates.find((c) => c.name === "Rebecca Whiting")?.party).toBe("L");
    expect(sen.candidates.find((c) => c.name === "Marisa Simonetti")?.party).toBe("I");
    expect(sen.units.length).toBe(22); // counties 01-20 + Hennepin + Ramsey in the truncated fixture
    expect(sen.units.every((u) => u.fips?.startsWith("27"))).toBe(true);
    expect(sen.precinctsTotal).toBe(sen.units.reduce((s, u) => s + (u.precinctsTotal ?? 0), 0));
    const gov = races.find((r) => r.id === "governor:MN")!;
    expect(gov.candidates.find((c) => c.party === "D")?.name).toMatch(/Klobuchar/);
    expect(gov.candidates.find((c) => c.party === "G")).toBeDefined();
  });

  it("2024 general: precinct → county aggregation sums and Hennepin unit", async () => {
    const fetchStub = fixtureFetch([["/20241105/allracesbyprecinct.txt", fixture("mn/allracesbyprecinct.2024.truncated.txt")]]);
    const ctx = makeCtx(fetchStub);
    const races = await makeMnAdapter({ electionDate: "20241105" }).fetch(ctx);
    const sen = races.find((r) => r.id === "senate:MN")!;
    expect(sen.status).toBe("counting");
    expect(sen.leaderId).toBe("klobuchar-amy");
    expect(sen.totalVotes).toBe(sen.units.reduce((s, u) => s + u.totalVotes, 0));
    expect(sen.precinctsReporting).toBe(sen.precinctsTotal);
    const henn = sen.units.find((u) => u.fips === "27053")!;
    expect(henn.name).toBe("Hennepin");
    expect(henn.totalVotes).toBe(sumVotes(henn.votes));
    expect(henn.totalVotes).toBeGreaterThan(600_000);
    expect(henn.complete).toBe(true);
    expect(henn.margin).toBeGreaterThan(30);
    const h2 = races.find((r) => r.id === "house:MN-02")!;
    expect(h2.candidates.find((c) => c.party === "D")?.name).toMatch(/Craig/);
    // President is not a tracked office
    expect(races.some((r) => /president/i.test(r.name))).toBe(false);
  });
});
