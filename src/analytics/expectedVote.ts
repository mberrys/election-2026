/**
 * Expected vote (AP-style proxy).
 *
 * AP publishes no formula; this is the implementable proxy from
 * docs/research/05-kornacki-analytics.md section 1 [ANALYST]:
 *
 *   EV = max( votesIn, baselineTurnout * turnoutAdj, earlyReturned + electionDayEstimate )
 *
 * Fallbacks, in order:
 *   - precincts-only:  EV = votesIn / p  (== votesIn + votesIn*(1-p)/p), p clamped <= 0.95
 *   - votes-only:      EV = votesIn (then re-baselined upward, see below)
 *
 * Rules:
 *   - pctExpected is a 0-1 FRACTION (not 0-100). It is capped at `pctCap` (0.99)
 *     until the feed flags the unit `complete`; only then is 1.0 reported.
 *   - Re-baseline upward whenever votesIn > rebaselineThreshold (0.97) * EV, so a
 *     unit that out-runs its baseline shows 97 % in rather than 100 %.
 *   - For a 2026 midterm the same-type baseline (turnout2022) is preferred. If only
 *     turnout2024 (presidential) is available it is scaled by PRES_TO_MIDTERM_TURNOUT_RATIO.
 *     That ratio is a heuristic (2022 ~46 % VEP vs 2024 ~64 % VEP ~ 0.72) - UNVERIFIED;
 *     override per state via opts.midtermRatio or opts.turnoutAdj.
 */
import type { ReportingUnit, VoteModes } from "../data/schema";

export const PRES_TO_MIDTERM_TURNOUT_RATIO = 0.75;
export const DEFAULT_PRECINCT_CLAMP = 0.95;
export const DEFAULT_PCT_CAP = 0.99;
export const DEFAULT_REBASELINE_THRESHOLD = 0.97;

export interface ExpectedVoteBaseline {
  turnout2024?: number;
  turnout2022?: number;
  /** Pre-election-day ballots already returned (early in-person + mail). */
  earlyReturned?: number;
}

export interface ExpectedVoteOptions {
  /** Multiplier on the baseline turnout (e.g. statewide early-vote pace vs 2022). Default 1. */
  turnoutAdj?: number;
  /** Estimated election-day votes for this unit; enables the `modes` candidate. */
  electionDayEstimate?: number;
  /** Scale applied to turnout2024 when turnout2022 is missing. Default 0.75. */
  midtermRatio?: number;
  /** Upper clamp on precinct fraction p. Default 0.95. */
  precinctClamp?: number;
  /** Max pctExpected reported for a non-complete unit. Default 0.99. */
  pctCap?: number;
  /** Re-baseline when votesIn exceeds this share of EV. Default 0.97. */
  rebaselineThreshold?: number;
}

export type ExpectedVoteMethod = "complete" | "baseline" | "modes" | "precincts" | "votes-only";

export interface ExpectedVoteResult {
  expectedVote: number;
  /** 0-1 fraction of expected vote counted. */
  pctExpected: number;
  /** Estimated votes still to be counted (>= 0). */
  remaining: number;
  method: ExpectedVoteMethod;
  /** True when EV was pushed up because votesIn exceeded the threshold share of it. */
  rebaselined: boolean;
}

export type ExpectedVoteUnit = Pick<ReportingUnit, "totalVotes"> &
  Partial<Pick<ReportingUnit, "precinctsReporting" | "precinctsTotal" | "modes" | "complete">>;

/** Pre-election-day ballots from a modes breakdown (early + mail), or undefined if neither is known. */
export function preElectionDayVotes(modes: VoteModes | undefined): number | undefined {
  if (!modes) return undefined;
  if (modes.early === undefined && modes.mail === undefined) return undefined;
  return (modes.early ?? 0) + (modes.mail ?? 0);
}

/**
 * Apply the completion / cap / re-baseline rules to a raw EV candidate.
 * Shared by unit-level and race-level aggregation.
 */
export function finalizeExpectedVote(
  votesIn: number,
  rawExpected: number,
  complete: boolean,
  method: ExpectedVoteMethod,
  opts: ExpectedVoteOptions = {},
): ExpectedVoteResult {
  const v = Math.max(0, votesIn);
  if (complete) {
    return { expectedVote: v, pctExpected: 1, remaining: 0, method: "complete", rebaselined: false };
  }
  const threshold = opts.rebaselineThreshold ?? DEFAULT_REBASELINE_THRESHOLD;
  const cap = opts.pctCap ?? DEFAULT_PCT_CAP;
  let ev = Math.max(v, rawExpected);
  let rebaselined = false;
  if (v > 0 && v > threshold * ev) {
    ev = v / threshold;
    rebaselined = true;
  }
  const pct = ev > 0 ? Math.min(v / ev, cap) : 0;
  return { expectedVote: ev, pctExpected: pct, remaining: Math.max(ev - v, 0), method, rebaselined };
}

export function estimateExpectedVote(
  unit: ExpectedVoteUnit,
  baseline: ExpectedVoteBaseline = {},
  opts: ExpectedVoteOptions = {},
): ExpectedVoteResult {
  const votesIn = Math.max(0, unit.totalVotes ?? 0);
  if (unit.complete) return finalizeExpectedVote(votesIn, votesIn, true, "complete", opts);

  const turnoutAdj = opts.turnoutAdj ?? 1;
  const midtermRatio = opts.midtermRatio ?? PRES_TO_MIDTERM_TURNOUT_RATIO;
  const candidates: Array<{ value: number; method: ExpectedVoteMethod }> = [];

  const baseTurnout =
    baseline.turnout2022 ??
    (baseline.turnout2024 !== undefined ? baseline.turnout2024 * midtermRatio : undefined);
  if (baseTurnout !== undefined && baseTurnout > 0) {
    candidates.push({ value: baseTurnout * turnoutAdj, method: "baseline" });
  }

  const early = baseline.earlyReturned ?? preElectionDayVotes(unit.modes);
  if (early !== undefined && opts.electionDayEstimate !== undefined) {
    candidates.push({ value: early + opts.electionDayEstimate, method: "modes" });
  }

  if (
    candidates.length === 0 &&
    unit.precinctsReporting !== undefined &&
    unit.precinctsTotal !== undefined &&
    unit.precinctsTotal > 0 &&
    unit.precinctsReporting > 0 &&
    votesIn > 0
  ) {
    const p = Math.min(
      unit.precinctsReporting / unit.precinctsTotal,
      opts.precinctClamp ?? DEFAULT_PRECINCT_CLAMP,
    );
    candidates.push({ value: votesIn / p, method: "precincts" });
  }

  // "votes-only" means no independent estimate exists. When a baseline exists but counting has outrun it,
  // keep the baseline method: finalizeExpectedVote re-baselines upward (votesIn / threshold).
  let best: { value: number; method: ExpectedVoteMethod } = { value: votesIn, method: "votes-only" };
  if (candidates.length) {
    best = candidates.reduce((a, b) => (b.value >= a.value ? b : a));
    if (best.value < votesIn) best = { value: votesIn, method: best.method };
  }

  return finalizeExpectedVote(votesIn, best.value, false, best.method, opts);
}
