import { describe, expect, it } from "vitest";
import { needsOfRemaining, requiredShareToLead } from "../../src/analytics/needs";

describe("needsOfRemaining", () => {
  it("tie: D down 20k with 50k left needs 70% of the remainder; R needs 30%", () => {
    const r = needsOfRemaining({ dVotes: 40000, rVotes: 60000, remaining: 50000 });
    // x = (1 + 20000/50000)/2 = 0.7
    expect(r.dShare).toBeCloseTo(70, 10);
    expect(r.rShare).toBeCloseTo(30, 10);
    expect(r.dImpossible).toBe(false);
    expect(r.rImpossible).toBe(false);
    expect(r.dDeficitVotes).toBe(20000);
  });

  it("flags impossible when the deficit exceeds the remainder", () => {
    const r = needsOfRemaining({ dVotes: 40000, rVotes: 60000, remaining: 10000 });
    // x = (1 + 20000/10000)/2 = 1.5 -> 150%
    expect(r.dShare).toBeCloseTo(150, 10);
    expect(r.dImpossible).toBe(true);
    // R needs (1 - 2)/2 = -50% -> already past the target, also outside [0,100]
    expect(r.rShare).toBeCloseTo(-50, 10);
    expect(r.rImpossible).toBe(true);
  });

  it("applies a target margin as a share of the final expected vote", () => {
    // tied 50k/50k, 50k left, want D+4 of 150k = 6000 votes -> x = (1 + 6000/50000)/2 = 0.56
    const r = needsOfRemaining({ dVotes: 50000, rVotes: 50000, remaining: 50000, targetMarginPts: 4 });
    expect(r.dShare).toBeCloseTo(56, 10);
    expect(r.rShare).toBeCloseTo(56, 10);
  });

  it("counts other-party votes toward the expected vote the target is applied to", () => {
    const withOther = needsOfRemaining({ dVotes: 50000, rVotes: 50000, otherVotes: 50000, remaining: 50000, targetMarginPts: 4 });
    // EV 200k -> target 8000 -> x = (1 + 8000/50000)/2 = 0.58
    expect(withOther.dShare).toBeCloseTo(58, 10);
  });

  it("with nothing remaining: 0 if already met, Infinity (impossible) otherwise", () => {
    const met = needsOfRemaining({ dVotes: 60, rVotes: 40, remaining: 0 });
    expect(met.dShare).toBe(0);
    expect(met.dImpossible).toBe(false);
    expect(met.rShare).toBe(Number.POSITIVE_INFINITY);
    expect(met.rImpossible).toBe(true);
  });
});

describe("requiredShareToLead", () => {
  it("trailing candidate needs (gap + remaining) / (2 remaining)", () => {
    const r = requiredShareToLead([{ id: "a", votes: 60 }, { id: "b", votes: 40 }], 50);
    expect(r.b.share).toBeCloseTo(70, 10);
    expect(r.a.share).toBeCloseTo(30, 10);
    expect(r.b.impossible).toBe(false);
  });

  it("flags impossible when the gap exceeds the remainder", () => {
    const r = requiredShareToLead([{ id: "a", votes: 60 }, { id: "b", votes: 40 }], 10);
    expect(r.b.share).toBeCloseTo(150, 10);
    expect(r.b.impossible).toBe(true);
    expect(r.a.share).toBe(0); // can't go below 0
    expect(r.a.impossible).toBe(false);
  });

  it("uses the strongest other candidate in a multi-way race", () => {
    const r = requiredShareToLead([{ id: "a", votes: 50 }, { id: "b", votes: 30 }, { id: "c", votes: 20 }], 40);
    expect(r.c.share).toBeCloseTo(((50 - 20 + 40) / 80) * 100, 10);
    expect(r.b.share).toBeCloseTo(((50 - 30 + 40) / 80) * 100, 10);
  });

  it("single candidate needs nothing", () => {
    expect(requiredShareToLead([{ id: "a", votes: 1 }], 100).a.share).toBe(0);
  });
});
