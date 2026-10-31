import { describe, expect, it } from "vitest";
import { projectState, uncertaintyBand } from "../../src/analytics/projection";

describe("uncertaintyBand", () => {
  it("is 12 at 0% in, ~4.24 at 50%, floors at 0.5 when everything is in", () => {
    expect(uncertaintyBand(0)).toBe(12);
    expect(uncertaintyBand(0.5)).toBeCloseTo(12 * Math.pow(0.5, 1.5), 10);
    expect(uncertaintyBand(0.5)).toBeCloseTo(4.2426, 3);
    expect(uncertaintyBand(1)).toBe(0.5);
    expect(uncertaintyBand(0.99)).toBe(0.5);
  });

  it("accepts overrides", () => {
    expect(uncertaintyBand(0, { bandScale: 20 })).toBe(20);
    expect(uncertaintyBand(1, { bandFloor: 1 })).toBe(1);
  });
});

describe("projectState", () => {
  it("fully reported single unit projects its own margin", () => {
    const p = projectState([{ margin: 7, benchmarkMargin: 3, pctExpected: 1, expectedVote: 1000 }]);
    expect(p.projectedMarginDR).toBeCloseTo(7, 10);
    expect(p.band).toBe(0.5);
    expect(p.pctIn).toBe(1);
  });

  it("blends own residual with the cluster residual and propagates to unreported units", () => {
    const p = projectState([
      { id: "u1", margin: -6, benchmarkMargin: -10, pctExpected: 0.5, expectedVote: 1000 },
      { id: "u2", benchmarkMargin: 20, pctExpected: 0, expectedVote: 1000 },
    ]);
    // u1 residual +4, cluster "all" residual +4 -> u1 proj = -10 + .5*4 + .5*4 = -6; u2 proj = 20 + 4 = 24
    expect(p.clusterResiduals.all).toBeCloseTo(4, 10);
    expect(p.units[0].projectedMargin).toBeCloseTo(-6, 10);
    expect(p.units[1].projectedMargin).toBeCloseTo(24, 10);
    expect(p.projectedMarginDR).toBeCloseTo(9, 10);
    expect(p.pctIn).toBeCloseTo(0.25, 10);
    expect(p.band).toBeCloseTo(12 * Math.pow(0.75, 1.5), 10);
  });

  it("ignores residuals from units under 20% reported", () => {
    const p = projectState([
      { id: "u1", margin: 30, benchmarkMargin: -10, pctExpected: 0.1, expectedVote: 1000 },
      { id: "u2", benchmarkMargin: 20, pctExpected: 0, expectedVote: 1000 },
    ]);
    expect(p.units[0].residual).toBeUndefined();
    expect(p.units[0].projectedMargin).toBeCloseTo(-10, 10);
    expect(p.units[1].projectedMargin).toBeCloseTo(20, 10);
    expect(p.projectedMarginDR).toBeCloseTo(5, 10);
  });

  it("uses per-cluster residuals and falls back to the global residual for empty clusters", () => {
    const p = projectState([
      { id: "urban", cluster: "urban", margin: 14, benchmarkMargin: 10, pctExpected: 1, expectedVote: 100 },
      { id: "rural1", cluster: "rural", margin: -22, benchmarkMargin: -20, pctExpected: 1, expectedVote: 100 },
      { id: "rural2", cluster: "rural", benchmarkMargin: 0, pctExpected: 0, expectedVote: 100 },
      { id: "exurb", cluster: "exurban", benchmarkMargin: 5, pctExpected: 0, expectedVote: 100 },
    ]);
    expect(p.clusterResiduals.urban).toBeCloseTo(4, 10);
    expect(p.clusterResiduals.rural).toBeCloseTo(-2, 10);
    expect(p.clusterResiduals.exurban).toBeCloseTo(1, 10); // global = (4*100 - 2*100)/200
    expect(p.units[2].projectedMargin).toBeCloseTo(-2, 10);
    expect(p.units[3].projectedMargin).toBeCloseTo(6, 10);
    // state = (14 - 22 - 2 + 6)/4 = -1
    expect(p.projectedMarginDR).toBeCloseTo(-1, 10);
    expect(p.pctIn).toBeCloseTo(0.5, 10);
  });

  it("weights cluster residuals by votes reported", () => {
    const p = projectState([
      { id: "big", margin: 10, benchmarkMargin: 0, pctExpected: 1, expectedVote: 300 },
      { id: "small", margin: -10, benchmarkMargin: 0, pctExpected: 1, expectedVote: 100 },
    ]);
    expect(p.clusterResiduals.all).toBeCloseTo(5, 10);
  });

  it("handles no units", () => {
    const p = projectState([]);
    expect(p.projectedMarginDR).toBe(0);
    expect(p.band).toBe(12);
    expect(p.pctIn).toBe(0);
  });
});
