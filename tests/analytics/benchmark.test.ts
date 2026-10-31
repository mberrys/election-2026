import { describe, expect, it } from "vitest";
import { overUnder, tieMargin, uniformSwing, uniformSwingBenchmark } from "../../src/analytics/benchmark";
import { divergingT, swingVs2024 } from "../../src/analytics/swing";

describe("benchmark", () => {
  it("uniform swing benchmark adds the state swing to the unit's 2024 margin", () => {
    // state went R+2 in 2024, expected D+1 now -> swing +3; unit R+10 -> benchmark R+7
    expect(uniformSwing(-2, 1)).toBe(3);
    expect(uniformSwingBenchmark(-10, -2, 1)).toBe(-7);
  });

  it("tie margin is the unit lean relative to the state", () => {
    expect(tieMargin(-10, -2)).toBe(-8);
    expect(tieMargin(25, -2)).toBe(27);
  });

  it("overUnder is current minus benchmark", () => {
    expect(overUnder(-5, -7)).toBe(2);
    expect(overUnder(-9, -7)).toBe(-2);
  });
});

describe("swing", () => {
  it("swingVs2024 is now minus 2024", () => {
    expect(swingVs2024(5, -3)).toBe(8);
    expect(swingVs2024(-12, -3)).toBe(-9);
  });

  it("divergingT maps -30..+30 to 0..1 with 0 at the centre and clamps", () => {
    expect(divergingT(0)).toBe(0.5);
    expect(divergingT(30)).toBe(1);
    expect(divergingT(-30)).toBe(0);
    expect(divergingT(15)).toBeCloseTo(0.75, 10);
    expect(divergingT(-45)).toBe(0);
    expect(divergingT(99)).toBe(1);
    expect(divergingT(5, 10)).toBeCloseTo(0.75, 10);
  });
});
