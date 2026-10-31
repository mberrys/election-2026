import { describe, expect, it } from "vitest";
import { estimateExpectedVote, finalizeExpectedVote, preElectionDayVotes } from "../../src/analytics/expectedVote";

describe("estimateExpectedVote", () => {
  it("uses the 2022 turnout baseline when available", () => {
    const r = estimateExpectedVote({ totalVotes: 4000 }, { turnout2022: 10000 });
    expect(r.expectedVote).toBe(10000);
    expect(r.pctExpected).toBeCloseTo(0.4, 10);
    expect(r.remaining).toBe(6000);
    expect(r.method).toBe("baseline");
    expect(r.rebaselined).toBe(false);
  });

  it("scales 2024 presidential turnout by the midterm ratio when 2022 is missing", () => {
    const r = estimateExpectedVote({ totalVotes: 1500 }, { turnout2024: 10000 });
    expect(r.expectedVote).toBe(7500);
    expect(r.pctExpected).toBeCloseTo(0.2, 10);
    const r2 = estimateExpectedVote({ totalVotes: 1500 }, { turnout2024: 10000 }, { midtermRatio: 1 });
    expect(r2.expectedVote).toBe(10000);
  });

  it("applies turnoutAdj to the baseline", () => {
    const r = estimateExpectedVote({ totalVotes: 1000 }, { turnout2022: 10000 }, { turnoutAdj: 1.1 });
    expect(r.expectedVote).toBeCloseTo(11000, 6);
  });

  it("takes early + election-day estimate when larger than the baseline", () => {
    const r = estimateExpectedVote(
      { totalVotes: 3000, modes: { early: 2000, mail: 1000 } },
      { turnout2022: 7000 },
      { electionDayEstimate: 5000 },
    );
    expect(r.expectedVote).toBe(8000);
    expect(r.method).toBe("modes");
    expect(r.pctExpected).toBeCloseTo(0.375, 10);
  });

  it("falls back to precincts reporting when no baseline exists", () => {
    const r = estimateExpectedVote({ totalVotes: 5000, precinctsReporting: 50, precinctsTotal: 100 });
    expect(r.expectedVote).toBeCloseTo(10000, 6);
    expect(r.remaining).toBeCloseTo(5000, 6);
    expect(r.method).toBe("precincts");
  });

  it("clamps the precinct fraction at 0.95", () => {
    const r = estimateExpectedVote({ totalVotes: 5000, precinctsReporting: 99, precinctsTotal: 100 });
    expect(r.expectedVote).toBeCloseTo(5000 / 0.95, 6);
    expect(r.pctExpected).toBeCloseTo(0.95, 10);
  });

  it("never reports 100% unless complete: re-baselines upward past 97%", () => {
    const r = estimateExpectedVote({ totalVotes: 10000 }, { turnout2022: 9000 });
    expect(r.rebaselined).toBe(true);
    expect(r.expectedVote).toBeCloseTo(10000 / 0.97, 6);
    expect(r.pctExpected).toBeCloseTo(0.97, 10);
    expect(r.remaining).toBeCloseTo(10000 / 0.97 - 10000, 6);
    expect(r.pctExpected).toBeLessThan(1);
  });

  it("reports exactly 100% and zero remaining when the feed flags complete", () => {
    const r = estimateExpectedVote({ totalVotes: 10000, complete: true }, { turnout2022: 20000 });
    expect(r.expectedVote).toBe(10000);
    expect(r.pctExpected).toBe(1);
    expect(r.remaining).toBe(0);
    expect(r.method).toBe("complete");
  });

  it("votes-only: no baseline, no precincts -> assumes a 3% cushion", () => {
    const r = estimateExpectedVote({ totalVotes: 1000 });
    expect(r.method).toBe("votes-only");
    expect(r.pctExpected).toBeCloseTo(0.97, 10);
  });

  it("handles zero votes", () => {
    const r = estimateExpectedVote({ totalVotes: 0 }, { turnout2022: 500 });
    expect(r.expectedVote).toBe(500);
    expect(r.pctExpected).toBe(0);
    expect(r.remaining).toBe(500);
  });

  it("caps pct at the configured ceiling (only reachable when the re-baseline threshold is raised)", () => {
    // default threshold 0.97 re-baselines first
    const r = finalizeExpectedVote(985, 1000, false, "baseline");
    expect(r.rebaselined).toBe(true);
    expect(r.pctExpected).toBeCloseTo(0.97, 10);
    // with a 1.0 threshold the 0.99 cap takes over
    const r2 = finalizeExpectedVote(995, 1000, false, "baseline", { rebaselineThreshold: 1 });
    expect(r2.rebaselined).toBe(false);
    expect(r2.pctExpected).toBeCloseTo(0.99, 10);
    expect(r2.remaining).toBe(5);
  });

  it("preElectionDayVotes sums early and mail only", () => {
    expect(preElectionDayVotes(undefined)).toBeUndefined();
    expect(preElectionDayVotes({ electionDay: 5 })).toBeUndefined();
    expect(preElectionDayVotes({ early: 3, mail: 4, electionDay: 5 })).toBe(7);
  });
});
