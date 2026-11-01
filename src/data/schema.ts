import { z } from "zod";

/**
 * Shared data contract for the Big Board.
 *
 * Two layers:
 *  - Reference data (built at deploy / refreshed slowly): RaceMeta, StateMeta.
 *  - Live snapshot (written by /api/ingest every minute): Snapshot → Race → ReportingUnit.
 *
 * Race ids are stable strings used to join the two layers:
 *   senate:GA           senate:OH-special      governor:MI
 *   house:NC-01         house:AK-AL            ballot:CA-prop-50
 *   stateleg:MI-house   stateleg:MI-senate
 */

export const Party = z.enum(["D", "R", "I", "L", "G", "O"]);
export type Party = z.infer<typeof Party>;

export const Office = z.enum(["senate", "house", "governor", "ballot", "stateleg"]);
export type Office = z.infer<typeof Office>;

export const Tier = z.enum(["A", "B", "C"]); // A official statewide feed, B county feeds, C delayed/community
export type Tier = z.infer<typeof Tier>;

export const RatingCode = z.enum([
  "solid-d",
  "likely-d",
  "lean-d",
  "tilt-d",
  "tossup",
  "tilt-r",
  "lean-r",
  "likely-r",
  "solid-r",
]);
export type RatingCode = z.infer<typeof RatingCode>;

export const RaceStatus = z.enum([
  "not_started", // polls not closed / no votes
  "counting",
  "projected", // Big Board projection rule satisfied
  "runoff",
  "certified",
]);
export type RaceStatus = z.infer<typeof RaceStatus>;

export const VoteModes = z.object({
  early: z.number().optional(),
  mail: z.number().optional(),
  electionDay: z.number().optional(),
  provisional: z.number().optional(),
});
export type VoteModes = z.infer<typeof VoteModes>;

// ---------- Reference layer ----------

export const CandidateMeta = z.object({
  id: z.string(), // slug, stable across feeds: "ossoff-jon"
  name: z.string(),
  party: Party,
  incumbent: z.boolean().default(false),
  fecId: z.string().optional(),
  aliases: z.array(z.string()).default([]), // names as they appear in feeds
});
export type CandidateMeta = z.infer<typeof CandidateMeta>;

export const Ratings = z.object({
  consensus: RatingCode.optional(), // median of available
  cook: RatingCode.optional(),
  inside: RatingCode.optional(),
  sabato: RatingCode.optional(),
  asOf: z.string().optional(),
  source: z.string().optional(),
});
export type Ratings = z.infer<typeof Ratings>;

export const PollAverage = z.object({
  d: z.number(),
  r: z.number(),
  n: z.number(),
  asOf: z.string(),
  source: z.string(),
});

export const Money = z.object({
  receipts: z.record(z.string(), z.number()).default({}), // candidateId → $
  cashOnHand: z.record(z.string(), z.number()).default({}),
  asOf: z.string().optional(),
});

export const Baseline = z.object({
  presMargin2024: z.number().optional(), // D − R, points; negative = R
  presMargin2020: z.number().optional(),
  prevRaceMargin: z.number().optional(), // same office, last cycle
  prevRaceYear: z.number().optional(),
  turnout2024: z.number().optional(),
  turnout2022: z.number().optional(),
});
export type Baseline = z.infer<typeof Baseline>;

// ---------- Election history (public/data/reference/history.json) ----------

/** Election year (as a string key) -> D minus R margin in points; negative = R. */
export const MarginSeries = z.record(z.string(), z.number());
export type MarginSeries = z.infer<typeof MarginSeries>;

export const HistoryRow = z.object({
  pres: MarginSeries.default({}),
  senate: MarginSeries.default({}),
  governor: MarginSeries.default({}),
});
export type HistoryRow = z.infer<typeof HistoryRow>;

export const DistrictHistory = z.object({
  /** House margins within the current map era only (not comparable across redistricting). */
  house: MarginSeries.default({}),
  /** Presidential margin on 2026 lines (2020, 2024). */
  pres: MarginSeries.default({}),
  caveat: z.enum(["redrawn-2024", "redrawn-2026"]).optional(),
});
export type DistrictHistory = z.infer<typeof DistrictHistory>;

export const History = z.object({
  builtAt: z.string(),
  /** Presidential election years covered. */
  years: z.array(z.number()),
  national: z.object({
    pres: z.record(z.string(), z.object({ d: z.number(), r: z.number(), margin: z.number() })),
  }),
  states: z.record(z.string(), HistoryRow),
  districts: z.record(z.string(), DistrictHistory),
});
export type History = z.infer<typeof History>;

export const RaceMeta = z.object({
  id: z.string(),
  office: Office,
  state: z.string().length(2),
  district: z.string().optional(), // "01", "AL", or ballot slug
  special: z.boolean().default(false),
  name: z.string(),
  candidates: z.array(CandidateMeta),
  ratings: Ratings.default({}),
  polls: PollAverage.optional(),
  money: Money.optional(),
  baseline: Baseline.default({}),
  heldBy: Party.optional(), // party of the incumbent seat holder
  runoffRule: z.enum(["none", "majority"]).default("none"),
  notes: z.string().optional(),
});
export type RaceMeta = z.infer<typeof RaceMeta>;

export const StateMeta = z.object({
  abbr: z.string().length(2),
  name: z.string(),
  fips: z.string().length(2),
  pollCloseEt: z.string(), // "19:00" or "19:00/20:00" for split states (last close)
  pollCloseFirstEt: z.string().optional(),
  voteOrder: z.enum(["early-first", "eday-first", "mixed", "unknown"]).default("unknown"),
  voteOrderNote: z.string().optional(),
  tier: Tier.optional(), // expected live tier
  feeds: z.array(z.string()).default([]), // adapter ids
});
export type StateMeta = z.infer<typeof StateMeta>;

// ---------- Live layer ----------

export const CandidateResult = z.object({
  id: z.string(),
  name: z.string(),
  party: Party,
  votes: z.number(),
  pct: z.number(), // 0–100
  incumbent: z.boolean().optional(),
});
export type CandidateResult = z.infer<typeof CandidateResult>;

export const ReportingUnit = z.object({
  id: z.string(), // county fips when known, else slug
  name: z.string(),
  fips: z.string().optional(),
  level: z.enum(["county", "locality", "precinct"]).default("county"),
  votes: z.record(z.string(), z.number()), // candidateId → votes
  totalVotes: z.number(),
  precinctsReporting: z.number().optional(),
  precinctsTotal: z.number().optional(),
  modes: VoteModes.optional(),
  complete: z.boolean().optional(),
  // analytics (filled by ingest)
  expectedVote: z.number().optional(),
  pctExpected: z.number().optional(),
  margin: z.number().optional(), // D − R points among reported
  benchmarkMargin: z.number().optional(),
  overUnder: z.number().optional(),
  needsOfRemaining: z.number().optional(), // share of remaining D needs for a tie (0–100, >100 impossible)
  baselineMargin2024: z.number().optional(),
  /** Last time this unit's total changed (tracked for stall detection). */
  lastChangeAt: z.string().optional(),
});
export type ReportingUnit = z.infer<typeof ReportingUnit>;

export const Projection = z.object({
  winnerId: z.string(),
  party: Party,
  by: z.literal("bigboard"),
  at: z.string(),
  marginPts: z.number(),
  band: z.number(), // ± points model uncertainty at call time
});

export const RaceSource = z.object({
  adapter: z.string(),
  tier: Tier,
  url: z.string().optional(),
  fetchedAt: z.string(),
  attribution: z.string().optional(),
});

export const Race = z.object({
  id: z.string(),
  office: Office,
  state: z.string().length(2),
  district: z.string().optional(),
  special: z.boolean().default(false),
  name: z.string(),
  candidates: z.array(CandidateResult),
  totalVotes: z.number(),
  precinctsReporting: z.number().optional(),
  precinctsTotal: z.number().optional(),
  expectedVote: z.number().optional(),
  pctExpected: z.number().optional(),
  modes: VoteModes.optional(),
  leaderId: z.string().optional(),
  marginPts: z.number().optional(), // leader − runner-up, points
  marginDR: z.number().optional(), // D − R points
  status: RaceStatus,
  projection: Projection.optional(),
  model: z
    .object({
      projectedMarginDR: z.number(), // D − R final estimate
      band: z.number(),
      remainingVotes: z.number(),
      needsOfRemainingD: z.number().optional(),
      needsOfRemainingR: z.number().optional(),
    })
    .optional(),
  units: z.array(ReportingUnit).default([]),
  /** Litigation / set-aside ballot annotations (src/data/annotations.ts). Informational except a pending challengedBallots. */
  flags: z
    .array(
      z.object({
        kind: z.enum(["litigation", "set-aside", "count-paused", "advisory"]),
        summary: z.string(),
        url: z.string().optional(),
        /** Reporting or filings behind the summary. Prefer several independent ones over a single article. */
        sources: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
        challengedBallots: z.number().optional(),
        /** Where the challenge stands. Default "pending"; a "rejected" challenge no longer holds back calls. */
        standing: z.enum(["pending", "rejected"]).optional(),
        asOf: z.string(),
      }),
    )
    .optional(),
  source: RaceSource,
  updatedAt: z.string(),
  /** Last time the vote total changed (ingest-tracked); drives stalled-count detection. */
  lastChangeAt: z.string().optional(),
});
export type Race = z.infer<typeof Race>;

export const PartyCount = z.object({
  D: z.number().default(0),
  R: z.number().default(0),
  I: z.number().default(0),
});
export type PartyCount = z.infer<typeof PartyCount>;

export const BalanceOfPower = z.object({
  office: z.enum(["senate", "house", "governor"]),
  total: z.number(),
  majority: z.number(),
  notUp: PartyCount, // seats not on the ballot (Senate)
  called: PartyCount,
  leaning: PartyCount, // uncalled, by consensus rating lean
  tossup: z.number(),
  raceIds: z
    .object({
      calledD: z.array(z.string()),
      calledR: z.array(z.string()),
      calledI: z.array(z.string()),
      uncalled: z.array(z.string()),
    })
    .optional(),
});
export type BalanceOfPower = z.infer<typeof BalanceOfPower>;

export const FeedStatus = z.object({
  adapter: z.string(),
  tier: Tier,
  states: z.array(z.string()),
  ok: z.boolean(),
  lastOkAt: z.string().optional(),
  lastError: z.string().optional(),
  latencyMs: z.number().optional(),
  racesUpdated: z.number().default(0),
});
export type FeedStatus = z.infer<typeof FeedStatus>;

export const Snapshot = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  seq: z.number(), // monotonically increasing ingest counter
  races: z.array(Race),
  balance: z.object({
    senate: BalanceOfPower,
    house: BalanceOfPower,
    governor: BalanceOfPower,
  }),
  feeds: z.array(FeedStatus),
  notices: z.array(z.string()).default([]), // human-readable banners ("GA feed stale 4m")
});
export type Snapshot = z.infer<typeof Snapshot>;

// Compact national payload served to every viewer (≈30–60 KB): no per-unit detail.
export const NationalPayload = Snapshot.extend({
  races: z.array(Race.omit({ units: true })),
});
export type NationalPayload = z.infer<typeof NationalPayload>;

// ---------- helpers ----------

export function raceId(
  office: Office,
  state: string,
  district?: string,
  special = false,
): string {
  const st = state.toUpperCase();
  if (office === "senate") return special ? `senate:${st}-special` : `senate:${st}`;
  if (office === "governor") return `governor:${st}`;
  if (office === "house") return `house:${st}-${(district ?? "AL").padStart(2, "0")}`;
  return `${office}:${st}-${district ?? "unknown"}`;
}

export const RATING_LEAN: Record<RatingCode, Party | "tossup"> = {
  "solid-d": "D",
  "likely-d": "D",
  "lean-d": "D",
  "tilt-d": "D",
  tossup: "tossup",
  "tilt-r": "R",
  "lean-r": "R",
  "likely-r": "R",
  "solid-r": "R",
};

export const RATING_ORDER: RatingCode[] = [
  "solid-d",
  "likely-d",
  "lean-d",
  "tilt-d",
  "tossup",
  "tilt-r",
  "lean-r",
  "likely-r",
  "solid-r",
];
