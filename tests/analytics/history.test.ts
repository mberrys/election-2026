import { describe, expect, it } from "vitest";
import {
  closestYear,
  districtRows,
  lastTimeAtOrBeyond,
  logitSwing,
  nationRow,
  projectedMargin,
  sortRows,
  stateRows,
  swingSeries,
  type BuildInput,
} from "../../src/analytics/history";
import type { History, RaceMeta } from "../../src/data/schema";

const S = { "1976": 3, "1980": -10, "1984": -20, "2008": 8, "2020": -5, "2024": -14 };

describe("lastTimeAtOrBeyond", () => {
  it("finds the most recent election at least as D as a D projection", () => {
    expect(lastTimeAtOrBeyond(S, 3)).toBe(2008);
    expect(lastTimeAtOrBeyond(S, 9)).toBeUndefined();
  });

  it("is inclusive at the boundary", () => {
    expect(lastTimeAtOrBeyond(S, 8)).toBe(2008);
    expect(lastTimeAtOrBeyond(S, 3.01)).toBe(2008);
  });

  it("looks the other way for an R projection", () => {
    expect(lastTimeAtOrBeyond(S, -12)).toBe(2024);
    expect(lastTimeAtOrBeyond(S, -20)).toBe(1984);
    expect(lastTimeAtOrBeyond(S, -21)).toBeUndefined();
  });

  it("returns the latest election when it already qualifies", () => {
    expect(lastTimeAtOrBeyond(S, -1)).toBe(2024);
  });

  it("counts an even projection as D", () => {
    expect(lastTimeAtOrBeyond(S, 0)).toBe(2008);
  });

  it("handles an empty series", () => {
    expect(lastTimeAtOrBeyond({}, 5)).toBeUndefined();
  });
});

describe("closestYear / swingSeries", () => {
  it("picks the nearest margin and prefers the later year on a tie", () => {
    expect(closestYear(S, -6)).toBe(2020);
    expect(closestYear({ "2012": 2, "2016": -2 }, 0)).toBe(2016);
  });

  it("computes election-to-election change, positive toward D", () => {
    const sw = swingSeries({ "2016": -10, "2020": -5, "2024": -14 });
    expect(sw).toEqual([
      { from: 2016, to: 2020, delta: 5 },
      { from: 2020, to: 2024, delta: -9 },
    ]);
  });
});

describe("projectedMargin", () => {
  const base = { id: "senate:GA", baseline: {} };

  it("uses the race poll when present", () => {
    const p = projectedMargin({ ...base, polls: { d: 50, r: 44, n: 5, asOf: "2026-10-20", source: "VoteHub" } }, -2, {});
    expect(p).toMatchObject({ margin: 6, source: "poll" });
  });

  it("falls back to a bounded swing from the 2024 margin", () => {
    const p = projectedMargin({ ...base, polls: undefined }, -10, { genericMargin: 8, nationalBaseline: -1.5 });
    expect(p?.source).toBe("swing");
    // Moves toward D by about the national swing (9.5 pts) near the middle.
    expect(p!.margin).toBeGreaterThan(-10 + 8);
    expect(p!.margin).toBeLessThan(-10 + 9.6);
  });

  it("logitSwing: no swing when nothing changed, and lopsided units stay under 100", () => {
    expect(logitSwing(-23, -1.5, -1.5)).toBeCloseTo(-23, 6);
    const dc = logitSwing(84, -1.5, 8.6);
    expect(dc).toBeGreaterThan(84);
    expect(dc).toBeLessThan(90);
    expect(logitSwing(-60, -1.5, 8.6)).toBeGreaterThan(-60);
    expect(logitSwing(99.9, -1.5, 30)).toBeLessThan(100);
  });

  it("returns undefined with no poll and no anchor", () => {
    expect(projectedMargin({ ...base, polls: undefined }, undefined, { genericMargin: 8 })).toBeUndefined();
  });

  it("applies an optional shift, default none", () => {
    const polls = { d: 50, r: 44, n: 5, asOf: "x", source: "y" };
    expect(projectedMargin({ ...base, polls }, 0, { pollShift: 4 })?.margin).toBe(10);
    expect(projectedMargin({ ...base, polls }, 0, {})?.margin).toBe(6);
  });
});

const history: History = {
  builtAt: "x",
  years: [2016, 2020, 2024],
  national: {
    pres: {
      "2016": { d: 48, r: 46, margin: 2.1 },
      "2020": { d: 51, r: 47, margin: 4.5 },
      "2024": { d: 48, r: 50, margin: -1.5 },
    },
  },
  states: {
    TX: { pres: { "2016": -9, "2020": -5.6, "2024": -13.7 }, senate: {}, governor: {} },
    GA: { pres: { "2016": -5, "2020": 0.2, "2024": -2.2 }, senate: {}, governor: {} },
  },
  districts: {
    "TX-15": { house: { "2022": -8.5, "2024": -14.2 }, pres: { "2024": -18 }, caveat: "redrawn-2026" },
    "MI-07": { house: { "2022": 5.4, "2024": -3.7 }, pres: { "2020": 0, "2024": -1 } },
  },
};

const race = (id: string, state: string, extra: Partial<RaceMeta> = {}): RaceMeta =>
  ({ id, office: id.split(":")[0], state, special: false, name: id, candidates: [], ratings: {}, baseline: {}, runoffRule: "none", ...extra }) as RaceMeta;

const races: RaceMeta[] = [
  race("senate:GA", "GA", { polls: { d: 52, r: 43, n: 7, asOf: "2026-10-23", source: "VoteHub" } }),
  race("house:TX-15", "TX", { district: "15" }),
  race("house:MI-07", "MI", { district: "07", polls: { d: 49, r: 47, n: 4, asOf: "2026-10-01", source: "VoteHub" } }),
];

const input: BuildInput = { history, races, stateNames: { TX: "Texas", GA: "Georgia" }, genericMargin: 8 };

describe("row builders", () => {
  it("projects states from the statewide poll, else swing, and finds the last time", () => {
    const rows = stateRows(input, "pres");
    const ga = rows.find((r) => r.id === "GA")!;
    expect(ga.projection).toMatchObject({ margin: 9, source: "poll" });
    expect(ga.lastTime).toBeUndefined(); // never D+9 in this series
    const tx = rows.find((r) => r.id === "TX")!;
    expect(tx.projection?.source).toBe("swing");
    expect(tx.projection!.margin).toBeCloseTo(logitSwing(-13.7, -1.5, 8), 6);
    // Projected R+4.2: the latest election (R+13.7) is already at least that red.
    expect(tx.lastTime).toBe(2024);
    expect(tx.change).toBeCloseTo(tx.projection!.margin - -13.7, 6);
  });

  it("builds the national row from the generic ballot", () => {
    const n = nationRow(input);
    expect(n.projection?.margin).toBe(8);
    expect(n.lastTime).toBeUndefined();
  });

  it("builds district rows on the chosen yardstick and carries the caveat", () => {
    const rows = districtRows(input, "house");
    const tx = rows.find((r) => r.id === "TX-15")!;
    expect(tx.caveat).toBe("redrawn-2026");
    expect(tx.series).toEqual({ "2022": -8.5, "2024": -14.2 });
    const mi = rows.find((r) => r.id === "MI-07")!;
    expect(mi.projection).toMatchObject({ margin: 2, source: "poll" });
    expect(mi.lastTime).toBe(2022);
  });
});

describe("sortRows", () => {
  it("orders by projected margin, most Democratic first, with unprojected rows last", () => {
    const rows = stateRows(input, "pres");
    const sorted = sortRows(rows, "projected").map((r) => r.id);
    expect(sorted[0]).toBe("GA");
    const withNone = sortRows([...rows, { id: "ZZ", label: "ZZ", kind: "state", series: {} }], "projected");
    expect(withNone[withNone.length - 1].id).toBe("ZZ");
  });

  it("puts 'never' ahead of old years when sorting by last time", () => {
    const rows = stateRows(input, "pres");
    const sorted = sortRows(rows, "lastTime");
    expect(sorted[0].lastTime).toBeUndefined();
  });
});
