import { describe, expect, it } from "vitest";
import type { HistoryRowModel } from "../../src/analytics/history";
import { lastTimeSentence } from "../../src/components/history/summary";

const row = (over: Partial<HistoryRowModel>): HistoryRowModel => ({ id: "X", label: "X", kind: "state", series: {}, ...over });

describe("lastTimeSentence", () => {
  const series = { "1992": -0.3, "2020": -9, "2024": -13.1 };

  it("names the last election at least as far toward the projected side", () => {
    const s = lastTimeSentence(row({ series: { "1976": 3.2, "2024": -13.7 }, projection: { margin: 2.5, source: "poll" }, lastTime: 1976, latestYear: 2024, latestMargin: -13.7 }), "pres");
    expect(s).toBe("Projected D+2.5: last this Democratic in 1976 (D+3.2).");
  });

  it("says 'about where it voted' only when the projection is within 2 points of the latest result", () => {
    const s = lastTimeSentence(row({ series, projection: { margin: -12, source: "swing" }, lastTime: 2024, latestYear: 2024, closest: 2024 }), "pres");
    expect(s).toBe("Projected R+12.0, about where it voted in 2024 (R+13.1).");
  });

  it("describes a move back toward the middle instead of claiming it is about where it voted", () => {
    const s = lastTimeSentence(row({ series, projection: { margin: -0.1, source: "poll" }, lastTime: 2024, latestYear: 2024, closest: 1992 }), "pres");
    expect(s).toBe("Projected R+0.1, 13.0 points more Democratic than in 2024 (R+13.1). Closest past result: 1992 (R+0.3).");
  });

  it("handles the other direction, and no distinct closest year", () => {
    const s = lastTimeSentence(row({ series: { "2024": 20 }, projection: { margin: 10, source: "swing" }, lastTime: 2024, latestYear: 2024, closest: 2024 }), "pres");
    expect(s).toBe("Projected D+10.0, 10.0 points more Republican than in 2024 (D+20.0).");
  });

  it("explains when nothing in the range went that far, and when there is no projection", () => {
    expect(lastTimeSentence(row({ series: { "1976": 3, "2024": -4 }, projection: { margin: 40, source: "swing" } }), "pres")).toBe(
      "Projected D+40.0: no presidential election from 1976 to 2024 was as Democratic as that.",
    );
    expect(lastTimeSentence(row({}), "pres")).toBe("No poll or baseline to project from yet.");
  });
});
