import { describe, expect, it } from "vitest";
import { mapSimilarity, type HistoryRowModel } from "../../src/analytics/history";
import { buildFlashback, projectionBasis } from "../../src/components/history/flashback-data";

describe("mapSimilarity", () => {
  const past = {
    AA: { "2016": -10, "2020": -4, "2024": -12 },
    BB: { "2016": 8, "2020": 12, "2024": 6 },
    CC: { "2016": 1, "2020": 3, "2024": -2 },
  };

  it("ranks years by the mean absolute gap in margins, closest first", () => {
    const r = mapSimilarity({ AA: -5, BB: 11, CC: 2 }, past, [2016, 2020, 2024]);
    expect(r.map((x) => x.year)).toEqual([2020, 2016, 2024]);
    expect(r[0].meanGap).toBeCloseTo((1 + 1 + 1) / 3, 6);
    expect(r[0]).toMatchObject({ sameSide: 3, n: 3 });
  });

  it("counts states that lean the same way, with zero as D", () => {
    const r = mapSimilarity({ AA: 0, BB: 8, CC: -1 }, past, [2016]);
    expect(r[0]).toMatchObject({ year: 2016, sameSide: 1, n: 3 });
  });

  it("skips units with no result that year and years with nothing to compare", () => {
    const r = mapSimilarity({ AA: -5, ZZ: 4 }, past, [2016, 1976]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ year: 2016, n: 1, meanGap: 5 });
  });

  it("breaks ties toward the more recent year", () => {
    const r = mapSimilarity({ AA: 0 }, { AA: { "2012": 2, "2016": -2 } }, [2012, 2016]);
    expect(r[0].year).toBe(2016);
  });
});

const row = (over: Partial<HistoryRowModel>): HistoryRowModel => ({ id: "X", label: "X", kind: "state", series: {}, ...over });

describe("buildFlashback", () => {
  const years = [2016, 2020, 2024];
  const nation = row({ id: "US", label: "United States", kind: "nation", series: { "2016": 2.1, "2020": 4.5, "2024": -1.5 }, projection: { margin: 3, source: "poll" } });
  const states = [
    row({ id: "AA", label: "Alpha", series: { "2016": -10, "2020": -4, "2024": -12 }, projection: { margin: -5, source: "swing" } }),
    row({ id: "BB", label: "Beta", series: { "2016": 8, "2020": 12, "2024": 6 }, projection: { margin: 11, source: "poll", poll: { raceId: "senate:BB-special", d: 52, r: 41, n: 1, asOf: "2026-10-25", pollster: "X" } } }),
    row({ id: "CC", label: "Gamma", series: { "2016": 1, "2020": 3, "2024": -2 } }),
  ];
  const fb = buildFlashback(nation, states, years, "2026-10-30");

  it("adds a projected 2026 step after the past elections, with sides counted", () => {
    expect(fb.steps.map((s) => s.year)).toEqual([2016, 2020, 2024, 2026]);
    expect(fb.steps[3]).toMatchObject({ projected: true, national: 3, dWon: 1, rWon: 1 });
    expect(fb.steps[2]).toMatchObject({ projected: false, national: -1.5, dWon: 1, rWon: 2, matchup: ["Harris", "Trump"] });
  });

  it("aligns each place's margins with the steps, null where there is no projection", () => {
    expect(fb.places.AA.margins).toEqual([-10, -4, -12, -5]);
    expect(fb.places.CC.margins).toEqual([1, 3, -2, null]);
  });

  it("names the closest past map, comparing only places with a projection", () => {
    expect(fb.finding).toMatchObject({ year: 2020, sameSide: 2, n: 2, meanGap: 1, since: 2016 });
  });

  it("says where each 2026 figure comes from", () => {
    expect(projectionBasis(states[1])).toBe("Senate special poll average, 1 poll to Oct 25.");
    expect(projectionBasis(states[0])).toMatch(/^No statewide poll/);
    expect(projectionBasis(states[2])).toBeUndefined();
  });
});
