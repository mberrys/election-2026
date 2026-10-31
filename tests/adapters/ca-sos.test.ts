import { describe, expect, it } from "vitest";
import { makeCaAdapter, parseReporting } from "../../src/data/adapters/ca-sos";
import { Race } from "../../src/data/schema";
import { fixture, fixtureFetch, makeCtx, meta } from "./helpers";

const BASE = "https://api.sos.ca.gov/returns";

describe("ca-sos", () => {
  const fetchStub = fixtureFetch([
    [`${BASE}/governor`, fixture("ca/governor.json")],
    [`${BASE}/ballot-measures`, fixture("ca/ballot-measures.json")],
    [`${BASE}/status`, fixture("ca/status.json")],
    [`${BASE}/governor/county/alameda`, fixture("ca/governor-county-alameda.json")],
    [`${BASE}/governor/county/san-francisco`, fixture("ca/governor-county-san-francisco.json")],
    [`${BASE}/governor/county/los-angeles`, fixture("ca/governor-county-los-angeles.json")],
    [/\/governor\/county\//, { status: 500 }], // the other 55 counties: simulate API flakiness
    [`${BASE}/us-rep/district/1`, fixture("ca/us-rep-district-1.json")],
    [`${BASE}/us-rep/district/13`, fixture("ca/us-rep-district-13.json")],
    [`${BASE}/us-rep/district/52`, fixture("ca/us-rep-district-52.json")],
    [`${BASE}/us-rep`, { status: 500 }],
    [/\/us-rep\/district\//, { status: 500 }],
  ]);

  it("parses 'Reporting' strings", () => {
    expect(parseReporting("2.5% (588 of 23,860) precincts reporting")).toEqual({ reporting: 588, total: 23860 });
    expect(parseReporting("NaN% (0 of 0) precincts reporting")).toEqual({ reporting: 0, total: 0 });
    expect(parseReporting(undefined)).toEqual({});
  });

  it("governor + county units, 14 ballot measures, house districts with 500s skipped", async () => {
    const metas = [
      meta({
        id: "governor:CA",
        office: "governor",
        state: "CA",
        name: "CA Governor",
        candidates: [
          { id: "becerra-xavier", name: "Xavier Becerra", party: "D", aliases: [] },
          { id: "hilton-steve", name: "Steve Hilton", party: "R", aliases: [] },
        ],
      }),
    ];
    const ctx = makeCtx(fetchStub, metas);
    const races = await makeCaAdapter({ districts: [1, 13, 52, 53], concurrency: 4 }).fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();

    const gov = races.find((r) => r.id === "governor:CA")!;
    expect(gov.status).toBe("counting");
    expect(gov.precinctsReporting).toBe(588);
    expect(gov.precinctsTotal).toBe(23860);
    expect(gov.candidates.map((c) => c.id)).toEqual(["becerra-xavier", "hilton-steve"]);
    expect(gov.totalVotes).toBe(1125 + 972);
    expect(gov.leaderId).toBe("becerra-xavier");
    expect(gov.units.map((u) => u.fips).sort()).toEqual(["06001", "06037", "06075"]);
    expect(gov.units.find((u) => u.fips === "06075")?.name).toBe("San Francisco");
    expect(gov.units.find((u) => u.fips === "06001")?.precinctsTotal).toBe(627);

    const props = races.filter((r) => r.office === "ballot");
    expect(props.length).toBe(14);
    const p1 = races.find((r) => r.id === "ballot:CA-prop-01")!;
    expect(p1.candidates.map((c) => c.id)).toEqual(["yes", "no"]);
    expect(p1.totalVotes).toBe(1414 + 878);
    expect(p1.name).toMatch(/Proposition 1:/);

    const house = races.filter((r) => r.office === "house").map((r) => r.id).sort();
    expect(house).toEqual(["house:CA-01", "house:CA-13", "house:CA-52"]);
    const h13 = races.find((r) => r.id === "house:CA-13")!;
    expect(h13.candidates.find((c) => c.party === "R")?.name).toBe("Kevin Lincoln");
    expect(h13.precinctsTotal).toBe(974);
    expect(ctx.logs.some((l) => /district\/53/.test(l))).toBe(true);
  });

  it("fails only when both governor and ballot-measures are down", async () => {
    const down = fixtureFetch([[/.*/, { status: 500 }]]);
    await expect(makeCaAdapter({ districts: [] }).fetch(makeCtx(down))).rejects.toThrow(/unavailable/);
  });
});
