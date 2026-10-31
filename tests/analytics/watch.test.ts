import { describe, expect, it } from "vitest";
import { annotationState, resolveWatch } from "../../src/data/watch";

describe("resolveWatch", () => {
  it("starts from the base list", () => {
    const w = resolveWatch({ annotations: [] });
    expect(w.map((e) => e.state)).toEqual(["AK", "AZ", "CA", "GA", "MI", "WA"]);
    expect(w.every((e) => e.base)).toBe(true);
  });
  it("adds any annotated state with its reason", () => {
    const w = resolveWatch({
      annotations: [{ raceId: "governor:WI", kind: "advisory", summary: "Officials threatened", asOf: "2026-11-03" }],
    });
    expect(w.find((e) => e.state === "WI")).toEqual({ state: "WI", reasons: ["Advisory"], base: false });
  });
  it("adds stalled states and keeps them for the rest of the night", () => {
    const tick1 = resolveWatch({ annotations: [], stalledStates: ["PA"] });
    expect(tick1.find((e) => e.state === "PA")?.reasons).toEqual(["Stalled count"]);
    const tick2 = resolveWatch({ annotations: [], stalledStates: [], previous: tick1 });
    expect(tick2.find((e) => e.state === "PA")).toBeDefined();
  });
  it("reads the state from race ids", () => {
    expect(annotationState({ raceId: "house:NC-01" })).toBe("NC");
    expect(annotationState({ raceId: "senate:OH-special" })).toBe("OH");
    expect(annotationState({ state: "tx" })).toBe("TX");
  });
});
