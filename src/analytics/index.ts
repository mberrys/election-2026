/**
 * Big Board analytics: pure, dependency-free functions over the shared schema.
 *
 * Conventions
 *   - Margins are D - R in percentage points (negative = R).
 *   - pctExpected / pctIn are 0-1 FRACTIONS. needsOfRemaining shares are 0-100.
 *   - Nothing here mutates its inputs; applyAnalytics returns a new Race.
 */
import {
  RATING_LEAN,
  type Party,
  type Race,
  type RaceMeta,
  type RatingCode,
  type ReportingUnit,
  type StateMeta,
} from "../data/schema";
import { tieMargin, uniformSwingBenchmark } from "./benchmark";
import { callStatus } from "./callStatus";
import {
  estimateExpectedVote,
  finalizeExpectedVote,
  type ExpectedVoteOptions,
  type ExpectedVoteResult,
} from "./expectedVote";
import { needsOfRemaining } from "./needs";
import { projectState, uncertaintyBand, type ProjectionOptions, type ProjectionUnitInput } from "./projection";

export * from "./expectedVote";
export * from "./benchmark";
export * from "./needs";
export * from "./projection";
export * from "./callStatus";
export * from "./balanceOfPower";
export * from "./bellwethers";
export * from "./swing";

export interface UnitBaseline {
  margin2024?: number;
  margin2020?: number;
  turnout2024?: number;
  turnout2022?: number;
  /** Projection cluster key (urban/suburban/rural x region). Defaults to "all". */
  cluster?: string;
}

/**
 * Leader ids from prior ingest ticks, oldest first; or an object carrying just the previous tick's
 * leader (`{ prevLeaderId }`, what ingest keeps from the last national snapshot) and/or a `leaders` array.
 */
export type LeaderHistory =
  | ReadonlyArray<string | undefined>
  | { prevLeaderId?: string; leaders?: ReadonlyArray<string | undefined> };

export function normalizeHistory(history: LeaderHistory | undefined): ReadonlyArray<string | undefined> {
  if (!history) return [];
  if (Array.isArray(history)) return history as ReadonlyArray<string | undefined>;
  const h = history as { prevLeaderId?: string; leaders?: ReadonlyArray<string | undefined> };
  if (h.leaders) return h.leaders;
  return "prevLeaderId" in h && h.prevLeaderId !== undefined ? [h.prevLeaderId] : [];
}

export interface AnalyticsOptions {
  /** Min share of expected vote for a model call in early-first / eday-first states (default 0.85). */
  mirageMinPct?: number;
  /** Floor on the share of expected vote for any model call (watch states use 0.9). */
  minPctExpected?: number;
  /** ISO timestamp stamped on a new projection. Defaults to race.updatedAt. */
  now?: string;
  expectedVote?: ExpectedVoteOptions;
  projection?: ProjectionOptions;
  /** Consecutive ticks a leader must hold for a model call. Default 2. */
  stableTicks?: number;
  /** Override the pre-election expected D - R state margin. */
  stateExpectedMargin?: number;
  /** Band multiplier in known early-first / eday-first states while pctIn < 0.5. Default 1.5. */
  mirageBandMultiplier?: number;
}

/** Point margins implied by a consensus rating when no poll average exists [heuristic]. */
export const RATING_MARGIN_PTS: Record<RatingCode, number> = {
  "solid-d": 20,
  "likely-d": 10,
  "lean-d": 5,
  "tilt-d": 2,
  tossup: 0,
  "tilt-r": -2,
  "lean-r": -5,
  "likely-r": -10,
  "solid-r": -20,
};

/** Pre-election expected D - R margin: polls, then consensus rating, then last race, then 2024 pres. */
export function expectedStateMargin(meta: RaceMeta | undefined): number {
  if (!meta) return 0;
  if (meta.polls) return meta.polls.d - meta.polls.r;
  if (meta.ratings.consensus) return RATING_MARGIN_PTS[meta.ratings.consensus];
  if (meta.baseline.prevRaceMargin !== undefined) return meta.baseline.prevRaceMargin;
  if (meta.baseline.presMargin2024 !== undefined) return meta.baseline.presMargin2024;
  return 0;
}

export interface PartyTally {
  d: number;
  r: number;
  other: number;
  total: number;
}

export function tallyByParty(
  votes: Readonly<Record<string, number>>,
  partyOf: ReadonlyMap<string, Party>,
): PartyTally {
  let d = 0;
  let r = 0;
  let other = 0;
  for (const [id, v] of Object.entries(votes)) {
    const p = partyOf.get(id);
    if (p === "D") d += v;
    else if (p === "R") r += v;
    else other += v;
  }
  return { d, r, other, total: d + r + other };
}

/** D - R points among `total` votes, or undefined when nothing is reported. */
export function marginPts(d: number, r: number, total: number): number | undefined {
  return total > 0 ? ((d - r) / total) * 100 : undefined;
}

/** Keep schema numbers finite and JSON-safe (Infinity would serialize to null). */
export function clampFinite(x: number, limit = 999): number {
  if (Number.isNaN(x)) return 0;
  if (x === Number.POSITIVE_INFINITY) return limit;
  if (x === Number.NEGATIVE_INFINITY) return -limit;
  return Math.min(limit, Math.max(-limit, x));
}

function candidateParties(race: Race, meta: RaceMeta | undefined): Map<string, Party> {
  const m = new Map<string, Party>();
  for (const c of meta?.candidates ?? []) m.set(c.id, c.party);
  for (const c of race.candidates) m.set(c.id, c.party);
  return m;
}

function unitBaselineFor(unit: ReportingUnit, baselines: ReadonlyMap<string, UnitBaseline>): UnitBaseline | undefined {
  return (unit.fips !== undefined ? baselines.get(unit.fips) : undefined) ?? baselines.get(unit.id);
}

function isMirageState(stateMeta: StateMeta | undefined): boolean {
  return stateMeta?.voteOrder === "early-first" || stateMeta?.voteOrder === "eday-first";
}

interface UnitAnalytics {
  unit: ReportingUnit;
  est: ExpectedVoteResult;
  projectionInput: ProjectionUnitInput;
}

function analyzeUnit(
  unit: ReportingUnit,
  baseline: UnitBaseline | undefined,
  partyOf: ReadonlyMap<string, Party>,
  stateMargin2024: number | undefined,
  stateExpected: number,
  opts: AnalyticsOptions,
): UnitAnalytics {
  const est = estimateExpectedVote(
    unit,
    { turnout2024: baseline?.turnout2024, turnout2022: baseline?.turnout2022 },
    opts.expectedVote,
  );
  const t = tallyByParty(unit.votes, partyOf);
  const total = unit.totalVotes > 0 ? unit.totalVotes : t.total;
  const margin = marginPts(t.d, t.r, total);

  const m24 = baseline?.margin2024;
  let benchmarkMargin = stateExpected;
  let targetMarginPts = 0;
  if (m24 !== undefined) {
    benchmarkMargin = stateMargin2024 !== undefined ? uniformSwingBenchmark(m24, stateMargin2024, stateExpected) : m24;
    targetMarginPts = stateMargin2024 !== undefined ? tieMargin(m24, stateMargin2024) : 0;
  }
  const overUnder = margin !== undefined ? margin - benchmarkMargin : undefined;
  const needs = needsOfRemaining({ dVotes: t.d, rVotes: t.r, otherVotes: t.other, remaining: est.remaining, targetMarginPts });

  const next: ReportingUnit = {
    ...unit,
    expectedVote: est.expectedVote,
    pctExpected: est.pctExpected,
    benchmarkMargin,
    needsOfRemaining: clampFinite(needs.dShare),
  };
  if (margin !== undefined) next.margin = margin;
  if (overUnder !== undefined) next.overUnder = overUnder;
  if (m24 !== undefined) next.baselineMargin2024 = m24;

  return {
    unit: next,
    est,
    projectionInput: {
      id: unit.id,
      margin,
      benchmarkMargin,
      pctExpected: est.pctExpected,
      expectedVote: est.expectedVote,
      votesIn: total,
      cluster: baseline?.cluster,
    },
  };
}

/**
 * Fill every analytics field on a race and its units. Pure: returns a new Race, never mutates.
 *
 * @param race          live race from an adapter (units may be empty)
 * @param meta          reference data (candidates, ratings, polls, baselines, runoff rule)
 * @param stateMeta     state reference (vote order is used to widen the band in mirage states)
 * @param unitBaselines fips (or unit id) -> 2024/2020 margins, 2022/2024 turnout, cluster
 * @param history       leader ids from prior ticks, oldest first (for call stability)
 */
export function applyAnalytics(
  race: Race,
  meta: RaceMeta | undefined,
  stateMeta: StateMeta | undefined,
  unitBaselines: ReadonlyMap<string, UnitBaseline> = new Map(),
  history: LeaderHistory = [],
  opts: AnalyticsOptions = {},
): Race {
  const partyOf = candidateParties(race, meta);
  const stateMargin2024 = meta?.baseline.presMargin2024;
  const stateExpected = opts.stateExpectedMargin ?? expectedStateMargin(meta);

  const unitResults = race.units.map((u) =>
    analyzeUnit(u, unitBaselineFor(u, unitBaselines), partyOf, stateMargin2024, stateExpected, opts),
  );

  // Race-level tallies from the candidate list (the authoritative statewide count).
  const raceVotes: Record<string, number> = {};
  for (const c of race.candidates) raceVotes[c.id] = (raceVotes[c.id] ?? 0) + c.votes;
  const t = tallyByParty(raceVotes, partyOf);
  const totalVotes = race.totalVotes > 0 ? race.totalVotes : t.total;
  const marginDR = marginPts(t.d, t.r, totalVotes);

  // Race-level expected vote: sum of unit estimates when units exist, else race baseline.
  let raceEst: ExpectedVoteResult;
  if (unitResults.length > 0) {
    const sumEv = unitResults.reduce((s, u) => s + u.est.expectedVote, 0);
    const allComplete = unitResults.every((u) => u.unit.complete === true);
    raceEst = finalizeExpectedVote(totalVotes, sumEv, allComplete, "baseline", opts.expectedVote);
  } else {
    raceEst = estimateExpectedVote(
      {
        totalVotes,
        precinctsReporting: race.precinctsReporting,
        precinctsTotal: race.precinctsTotal,
        modes: race.modes,
        complete: race.status === "certified",
      },
      { turnout2022: meta?.baseline.turnout2022, turnout2024: meta?.baseline.turnout2024 },
      opts.expectedVote,
    );
  }

  // With no turnout baseline and no precinct progress, "votes counted so far" is the only estimate of the
  // expected vote, which reads as ~97% in on the first batch. Treat that as unknown: 0% in, no call possible.
  const evUnknown = raceEst.method === "votes-only" && race.status !== "certified" && unitResults.length === 0;
  if (evUnknown) raceEst = { ...raceEst, pctExpected: 0, remaining: Math.max(raceEst.remaining, totalVotes * 50) };

  // Projection.
  let projectedMarginDR: number;
  let band: number;
  let pctIn: number;
  if (unitResults.length > 0) {
    const p = projectState(
      unitResults.map((u) => u.projectionInput),
      opts.projection,
    );
    projectedMarginDR = p.projectedMarginDR;
    band = p.band;
    pctIn = p.pctIn;
  } else {
    pctIn = raceEst.pctExpected;
    projectedMarginDR =
      marginDR === undefined ? stateExpected : pctIn * marginDR + (1 - pctIn) * stateExpected;
    band = uncertaintyBand(pctIn, opts.projection);
  }
  if (isMirageState(stateMeta) && pctIn < 0.5) band *= opts.mirageBandMultiplier ?? 1.5;

  const raceNeeds = needsOfRemaining({ dVotes: t.d, rVotes: t.r, otherVotes: t.other, remaining: raceEst.remaining });

  // Call.
  let status = race.status;
  let projection = race.projection;
  let leaderId: string | undefined;
  let leaderMarginPts: number | undefined;
  if (race.status === "certified") {
    const leader = [...race.candidates].sort((a, b) => b.votes - a.votes)[0];
    leaderId = leader?.id;
    const second = [...race.candidates].sort((a, b) => b.votes - a.votes)[1];
    if (leader && totalVotes > 0) leaderMarginPts = ((leader.votes - (second?.votes ?? 0)) / totalVotes) * 100;
  } else if (evUnknown) {
    status = totalVotes > 0 ? "counting" : "not_started";
    projection = undefined;
    const sorted = [...race.candidates].sort((a, b) => b.votes - a.votes);
    leaderId = totalVotes > 0 ? sorted[0]?.id : undefined;
    if (leaderId) leaderMarginPts = ((sorted[0].votes - (sorted[1]?.votes ?? 0)) / totalVotes) * 100;
  } else {
    const call = callStatus({
      candidates: race.candidates.map((c) => ({ id: c.id, party: c.party, votes: c.votes })),
      totalVotes,
      remaining: raceEst.remaining,
      pctExpected: raceEst.pctExpected,
      band,
      history: normalizeHistory(history),
      runoffRule: meta?.runoffRule,
      stableTicks: opts.stableTicks,
      // Vote-order states swing late (WI late mail, NC/GA election day): no model call before 85% in.
      minPctExpected: Math.max(isMirageState(stateMeta) ? (opts.mirageMinPct ?? 0.85) : 0.5, opts.minPctExpected ?? 0),
      challengedBallots: (race.flags ?? []).reduce((s, f) => s + (f.challengedBallots ?? 0), 0),
      priorProjection: race.projection,
      now: opts.now ?? race.updatedAt,
    });
    status = call.status;
    projection = call.projection;
    leaderId = call.leaderId;
    leaderMarginPts = call.leaderId ? call.marginPts : undefined;
  }

  const next: Race = {
    ...race,
    units: unitResults.map((u) => u.unit),
    expectedVote: raceEst.expectedVote,
    pctExpected: raceEst.pctExpected,
    status,
    model: {
      projectedMarginDR,
      band,
      remainingVotes: raceEst.remaining,
      needsOfRemainingD: clampFinite(raceNeeds.dShare),
      needsOfRemainingR: clampFinite(raceNeeds.rShare),
    },
  };
  if (projection) next.projection = projection;
  else delete next.projection;
  if (leaderId !== undefined) next.leaderId = leaderId;
  else delete next.leaderId;
  if (leaderMarginPts !== undefined) next.marginPts = leaderMarginPts;
  else delete next.marginPts;
  if (marginDR !== undefined) next.marginDR = marginDR;
  else delete next.marginDR;
  return next;
}

/** Consensus-rating lean helper re-exported for UI convenience. */
export function ratingLean(rating: RatingCode | undefined): Party | "tossup" {
  return rating ? RATING_LEAN[rating] : "tossup";
}
