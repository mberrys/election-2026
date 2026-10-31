/**
 * Big Board projection rule (our own call, independent of any external decision desk).
 *
 * A race is "projected" when either
 *   (a) mathematically decided: leader's vote margin > estimated remaining votes, or
 *   (b) model call: leader margin (pts) > max(2, band) AND pctExpected >= 0.5 AND the same
 *       leader has held the lead for >= stableTicks consecutive ticks (current tick + prior
 *       tick leaders passed in `history`).
 *
 * Majority-runoff states (GA): a plurality is not enough.
 *   - finalTotal = totalVotes + remaining
 *   - if leader.votes + remaining <= 0.5 * finalTotal  -> nobody can reach a majority -> "runoff"
 *   - if leader.votes > 0.5 * finalTotal               -> majority locked -> projected
 *   - otherwise the model call additionally requires the leader's current share to exceed
 *     50 + max(2, band)/2 (a majority with a cushion) [heuristic]; else keep counting.
 *
 * Stickiness: a prior Big Board projection is kept as long as the projected winner is still the
 * leader. If the lead flips, the projection is dropped and the race returns to "counting".
 */
import type { Party, RaceStatus } from "../data/schema";

export interface CallCandidate {
  id: string;
  party: Party;
  votes: number;
}

export interface ProjectionRecord {
  winnerId: string;
  party: Party;
  by: "bigboard";
  at: string;
  marginPts: number;
  band: number;
}

export interface CallInput {
  candidates: ReadonlyArray<CallCandidate>;
  /** Total votes reported in the race. */
  totalVotes: number;
  /** Estimated votes still to be counted. */
  remaining: number;
  /** 0-1 fraction of expected vote counted. */
  pctExpected: number;
  /** Model uncertainty band in points. */
  band: number;
  /** Leader ids from prior ticks, oldest first (undefined where there was no leader). */
  history?: ReadonlyArray<string | undefined>;
  runoffRule?: "none" | "majority";
  /** Consecutive ticks (including this one) the leader must have led for a model call. Default 2. */
  stableTicks?: number;
  /** Minimum share of expected vote before a model (non-mathematical) call. Default 0.5; mirage states use more. */
  minPctExpected?: number;
  /**
   * Ballots set aside / under legal challenge that could still be added or removed. A lead must exceed this
   * pool (on top of remaining votes for a decided call) before we project. Default 0.
   */
  challengedBallots?: number;
  /** Existing Big Board projection, kept if the winner still leads. */
  priorProjection?: ProjectionRecord;
  /** ISO timestamp for a new projection. Defaults to new Date().toISOString(). */
  now?: string;
}

export type CallReason =
  | "no-votes"
  | "decided"
  | "model"
  | "majority-locked"
  | "runoff-locked"
  | "sticky"
  | "counting";

export interface CallResult {
  status: RaceStatus;
  projection?: ProjectionRecord;
  reason: CallReason;
  leaderId?: string;
  marginVotes: number;
  marginPts: number;
}

export function callStatus(input: CallInput): CallResult {
  const total = Math.max(0, input.totalVotes);
  const sorted = [...input.candidates].sort((a, b) => b.votes - a.votes);
  const leader = sorted[0];
  if (!leader || total <= 0 || leader.votes <= 0) {
    return { status: "not_started", reason: "no-votes", marginVotes: 0, marginPts: 0 };
  }
  const runnerUp = sorted[1];
  const marginVotes = leader.votes - (runnerUp?.votes ?? 0);
  const marginPts = (marginVotes / total) * 100;
  const remaining = Math.max(0, input.remaining);
  const stableTicks = Math.max(1, input.stableTicks ?? 2);
  const threshold = Math.max(2, input.band);

  const makeProjection = (): ProjectionRecord => ({
    winnerId: leader.id,
    party: leader.party,
    by: "bigboard",
    at: input.now ?? new Date().toISOString(),
    marginPts,
    band: input.band,
  });
  const base = { leaderId: leader.id, marginVotes, marginPts };

  // Stickiness: keep an existing projection while its winner still leads.
  if (input.priorProjection && input.priorProjection.winnerId === leader.id) {
    return { status: "projected", projection: input.priorProjection, reason: "sticky", ...base };
  }

  const challenged = Math.max(0, input.challengedBallots ?? 0);
  const decided = marginVotes > remaining + challenged;
  const history = input.history ?? [];
  const needPrior = stableTicks - 1;
  let stable = history.length >= needPrior;
  for (let i = 1; i <= needPrior && stable; i++) {
    if (history[history.length - i] !== leader.id) stable = false;
  }
  const modelCall = marginPts > threshold && input.pctExpected >= (input.minPctExpected ?? 0.5) && stable && marginVotes > challenged;

  if (input.runoffRule === "majority") {
    const finalTotal = total + remaining;
    const canReachMajority = leader.votes + remaining > 0.5 * finalTotal;
    if (!canReachMajority) {
      return { status: "runoff", reason: "runoff-locked", ...base };
    }
    const majorityLocked = leader.votes > 0.5 * finalTotal;
    if (majorityLocked) {
      return { status: "projected", projection: makeProjection(), reason: "majority-locked", ...base };
    }
    const leaderPct = (leader.votes / total) * 100;
    if (modelCall && leaderPct > 50 + threshold / 2) {
      return { status: "projected", projection: makeProjection(), reason: "model", ...base };
    }
    return { status: "counting", reason: "counting", ...base };
  }

  if (decided) return { status: "projected", projection: makeProjection(), reason: "decided", ...base };
  if (modelCall) return { status: "projected", projection: makeProjection(), reason: "model", ...base };
  return { status: "counting", reason: "counting", ...base };
}
