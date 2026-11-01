import { describe, expect, it } from "vitest";
import { niceScale, shortYear, spreadLabels } from "@/components/charts/scale";
import { buildMarginHistory, historyTakeaway, type MarginHistoryModel } from "@/components/charts/margin-history-data";
import { axisDomain, axisMarks, axisTakeaway, placeMarks, ratingBand } from "@/components/charts/margin-axis-data";
import { ratingCounts } from "@/components/charts/ratings-strip-data";
import { ratingFill } from "@/components/charts/rating-color";
import type { History, RaceMeta } from "@/data/schema";

const model = (margins: number[], startYear = 2000): MarginHistoryModel => ({
  abbr: "XX",
  bars: margins.map((margin, i) => ({ year: startYear + i * 4, margin })),
  nation: [],
  races: [],
});

describe("niceScale", () => {
  it("gives 3 to 5 round ticks with the top above the max and the bottom at or below the min", () => {
    for (const [lo, hi] of [
      [-20.39, 33.88],
      [41.2, 55.6],
      [-3, 4],
      [0, 0],
      [-57, 12],
    ]) {
      const s = niceScale(lo, hi);
      expect(s.ticks.length).toBeGreaterThanOrEqual(3);
      expect(s.ticks.length).toBeLessThanOrEqual(5);
      expect(s.lo).toBeLessThanOrEqual(lo);
      expect(s.hi).toBeGreaterThan(hi);
      expect(s.ticks[0]).toBe(s.lo);
      expect(s.ticks[s.ticks.length - 1]).toBe(s.hi);
    }
  });
  it("includes zero when the range spans it", () => {
    expect(niceScale(-20.39, 33.88).ticks).toContain(0);
  });
});

describe("spreadLabels", () => {
  it("keeps labels apart, in range, and returns them in input order", () => {
    const out = spreadLabels([100, 102, 50], 34, 20, 200);
    expect(out[2]).toBe(50);
    expect(Math.abs(out[0] - out[1])).toBeGreaterThanOrEqual(34);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...out)).toBeLessThanOrEqual(200);
  });
  it("pulls labels back up from the bottom edge", () => {
    expect(spreadLabels([198, 199, 200], 34, 20, 200)).toEqual([132, 166, 200]);
  });
  it("formats short years", () => expect(shortYear(1984)).toBe("’84"));
});

describe("buildMarginHistory", () => {
  const history = {
    builtAt: "",
    years: [2020, 2024],
    national: { pres: { "2020": { d: 51, r: 47, margin: 4.5 }, "2024": { d: 48, r: 50, margin: -1.5 } } },
    states: { GA: { pres: { "2020": 0.2, "2024": -2.2 }, senate: { "2022": 2.8, "2020": 1.2 }, governor: {} } },
    districts: {},
  } as unknown as History;
  it("joins state and national series and sorts the race series", () => {
    const m = buildMarginHistory(history, "GA", "senate")!;
    expect(m.bars.map((b) => b.year)).toEqual([2020, 2024]);
    expect(m.nation.map((n) => n.margin)).toEqual([4.5, -1.5]);
    expect(m.races.map((r) => r.year)).toEqual([2020, 2022]);
    expect(m.raceLabel).toBe("Senate");
  });
  it("drops the race label when the office has no history, and returns undefined for unknown states", () => {
    expect(buildMarginHistory(history, "GA", "governor")!.raceLabel).toBeUndefined();
    expect(buildMarginHistory(history, "ZZ", "senate")).toBeUndefined();
  });
});

describe("historyTakeaway", () => {
  it("counts close recent elections", () => {
    expect(historyTakeaway(model([-8, -5, 0.2, -2.2]), "Georgia")).toBe("Georgia has voted within 3 points in two of the last four presidential elections.");
    expect(historyTakeaway(model([-1, 0.5, 2, -2.2]), "Georgia")).toBe("Georgia has voted within 3 points in each of the last four presidential elections.");
    expect(historyTakeaway(model([-8, 0.5, 2, -2.9]), "Georgia")).toBe("Georgia has voted within 3 points in three of the last four presidential elections.");
  });
  it("describes a long one-party streak", () => {
    expect(historyTakeaway(model([5, -20, -22, -30, -28]), "Wyoming")).toBe("Wyoming has voted Republican in each of the last 4 presidential elections, by 25.0 points on average.");
    expect(historyTakeaway(model([20, 22, 30]), "Vermont")).toBe("Vermont has voted Democratic in every presidential election since 2000, by 24.0 points on average.");
  });
  it("falls back to the last two elections", () => {
    expect(historyTakeaway(model([10, -12, 8, -15, 9, -20]), "Ohio")).toBe("Ohio moved from Democratic in 2016 to Republican in 2020, by 20.0 points.");
    expect(historyTakeaway(model([-12, 8, -15, 9, 20, 15]), "Ohio")).toBeDefined();
  });
  it("returns nothing for a single election", () => {
    expect(historyTakeaway(model([4]), "X")).toBeUndefined();
  });
});

const meta = (over: Partial<RaceMeta>): RaceMeta =>
  ({ id: "r", office: "senate", state: "GA", name: "n", candidates: [], ratings: {}, baseline: {}, special: false, runoffRule: "none", ...over }) as RaceMeta;

describe("margin axis", () => {
  it("builds marks only from data that exists", () => {
    const m = axisMarks(
      meta({ ratings: { consensus: "lean-d" }, polls: { d: 49, r: 46, n: 3, asOf: "x", source: "s" } as RaceMeta["polls"], baseline: { presMargin2024: -2.2, prevRaceMargin: 1.2, prevRaceYear: 2020 } }),
    );
    expect(m.map((x) => x.key)).toEqual(["forecast", "poll", "prev", "p24"]);
    expect(m.find((x) => x.key === "poll")!.text).toBe("D+3.0");
    expect(m.find((x) => x.key === "prev")!.name).toBe("2020 Senate");
    expect(axisMarks(meta({}))).toEqual([]);
  });
  it("states the poll shift against 2024", () => {
    const marks = axisMarks(meta({ polls: { d: 49, r: 46 } as RaceMeta["polls"], baseline: { presMargin2024: -2.2 } }));
    expect(axisTakeaway(marks)).toBe("Polls run 5.2 points more Democratic than the 2024 presidential result.");
    expect(axisTakeaway(axisMarks(meta({ baseline: { presMargin2024: -2 } })))).toBeUndefined();
  });
  it("sizes the domain from the data marks, capped at 40", () => {
    expect(axisDomain(axisMarks(meta({ baseline: { presMargin2024: 3 } })))).toBe(10);
    expect(axisDomain(axisMarks(meta({ baseline: { presMargin2024: -14 } })))).toBe(20);
    expect(axisDomain(axisMarks(meta({ baseline: { presMargin2024: -57 } })))).toBe(40);
  });
  it("maps ratings to margin bands on each side", () => {
    expect(ratingBand("lean-d")).toEqual([2, 5]);
    expect(ratingBand("lean-r")).toEqual([-5, -2]);
    expect(ratingBand("tossup")).toEqual([-1, 1]);
    const mark = (r: string) => axisMarks(meta({ ratings: { consensus: r as never } }))[0];
    expect(mark("solid-r").value).toBe(-15);
    expect(mark("solid-d").value).toBe(15);
    expect(mark("tilt-r").value).toBe(-1);
    expect(mark("tossup").value).toBe(0);
  });
  it("never overlaps labels in a row, and rarely runs a pole through a label", () => {
    const scenarios: Partial<RaceMeta>[] = [
      { ratings: { consensus: "tilt-r" }, polls: { d: 48, r: 49 } as RaceMeta["polls"], baseline: { presMargin2024: -2.2, presMargin2020: 0.2, prevRaceMargin: 1.2, prevRaceYear: 2022 } },
      { ratings: { consensus: "solid-r" }, polls: { d: 30, r: 62 } as RaceMeta["polls"], baseline: { presMargin2024: -33, presMargin2020: -30, prevRaceMargin: -28, prevRaceYear: 2020 } },
      { ratings: { consensus: "lean-d" }, polls: { d: 52, r: 44 } as RaceMeta["polls"], baseline: { presMargin2024: 4, presMargin2020: 6, prevRaceMargin: 3, prevRaceYear: 2020 } },
    ];
    for (const sc of scenarios) {
      const marks = axisMarks(meta(sc));
      for (const W of [300, 640]) {
        const dom = axisDomain(marks);
        const xD = (v: number) => 22 + ((Math.max(-dom, Math.min(dom, -v)) + dom) / (2 * dom)) * (W - 44);
        const placed = placeMarks(marks, xD, W);
        expect(placed).toHaveLength(marks.length);
        let crossings = 0;
        for (const a of placed) {
          expect(a.from).toBeGreaterThanOrEqual(0);
          expect(a.to).toBeLessThanOrEqual(W);
          for (const b of placed) {
            if (a === b) continue;
            if (a.lane === b.lane) expect(a.to <= b.from || a.from >= b.to).toBe(true);
            else if (a.lane < b.lane && b.x > a.from && b.x < a.to) crossings++;
          }
        }
        // Marks bunched inside 45px cannot always clear each other; the label halo masks the rare pole.
        expect(crossings).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("ratings strip", () => {
  const races = (codes: (string | undefined)[]) => codes.map((c) => ({ ratings: { consensus: c as never } }));
  it("tallies by rating and side", () => {
    const t = ratingCounts(races(["solid-d", "tilt-d", "tossup", "lean-r", "solid-r", "solid-r", undefined]));
    expect(t.dSide).toBe(2);
    expect(t.rSide).toBe(3);
    expect(t.tossup).toBe(1);
    expect(t.unrated).toBe(1);
    expect(t.total).toBe(7);
    expect(t.counts["solid-r"]).toBe(2);
  });
  it("picks ramp colours by strength", () => {
    expect(ratingFill("solid-d")).toBe("var(--ramp-d-5)");
    expect(ratingFill("tilt-r")).toBe("var(--ramp-r-2)");
    expect(ratingFill("tossup")).toBe("var(--ink-faint)");
  });
});
