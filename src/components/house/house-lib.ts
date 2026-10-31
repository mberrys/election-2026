import {
  RATING_LEAN,
  RATING_ORDER,
  type BalanceOfPower,
  type Party,
  type Race,
  type RaceMeta,
  type RatingCode,
} from "@/data/schema";

/** National payload race (no county units). */
export type LiveRace = Omit<Race, "units">;

export type MapMode = "status" | "margin" | "swing" | "ratings";
export type HouseFilter = "all" | "competitive" | "tossup" | "flip";

export const MAP_MODES: { value: MapMode; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "margin", label: "Margin" },
  { value: "swing", label: "Swing vs 2024" },
  { value: "ratings", label: "Ratings" },
];

export const HOUSE_FILTERS: { value: HouseFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "competitive", label: "Competitive" },
  { value: "tossup", label: "Toss-ups" },
  { value: "flip", label: "Flip watch" },
];

export const HOUSE_SEATS = 435;
export const HOUSE_MAJORITY = 218;

/** Which of D/R the seat is heading to (called wins first, then consensus lean), or null for toss-up/unknown. */
export type SeatLean = { party: Party | null; called: boolean };

export function seatLean(live: LiveRace | undefined, meta: RaceMeta | undefined): SeatLean {
  if (live?.projection) return { party: live.projection.party, called: true };
  const c = meta?.ratings.consensus;
  if (!c) return { party: null, called: false };
  const lean = RATING_LEAN[c];
  return { party: lean === "tossup" ? null : lean, called: false };
}

/** Lean/tilt/toss-up (anything not solid or likely). Unrated seats count as competitive so they are not silently hidden. */
export function isCompetitive(meta: RaceMeta | undefined): boolean {
  const c = meta?.ratings.consensus;
  if (!c) return true;
  return !c.startsWith("solid") && !c.startsWith("likely");
}

export function isTossup(meta: RaceMeta | undefined): boolean {
  return meta?.ratings.consensus === "tossup";
}

/** Seat held by one party but called/leaning to another (toss-ups held by anyone also count). */
export function isFlipWatch(live: LiveRace | undefined, meta: RaceMeta | undefined): boolean {
  if (!meta?.heldBy) return false;
  const { party } = seatLean(live, meta);
  if (party == null) return true;
  return party !== meta.heldBy;
}

export function matchesFilter(filter: HouseFilter, state: string | null, live: LiveRace | undefined, meta: RaceMeta | undefined): boolean {
  if (state && meta?.state !== state) return false;
  switch (filter) {
    case "all":
      return true;
    case "competitive":
      return isCompetitive(meta);
    case "tossup":
      return isTossup(meta);
    case "flip":
      return isFlipWatch(live, meta);
  }
}

/** Live D−R margin, only once votes are in. */
export function liveMarginDR(live: LiveRace | undefined): number | undefined {
  if (!live || live.status === "not_started" || !live.totalVotes) return undefined;
  return live.marginDR;
}

/** 2024 baseline used for the swing view: presidential margin on current lines, else the prior House margin. */
export function baselineMargin(meta: RaceMeta | undefined): number | undefined {
  return meta?.baseline.presMargin2024 ?? meta?.baseline.prevRaceMargin;
}

export function swingDR(live: LiveRace | undefined, meta: RaceMeta | undefined): number | undefined {
  const m = liveMarginDR(live);
  const b = baselineMargin(meta);
  if (m == null || b == null) return undefined;
  return m - b;
}

/** % of expected vote in, 0–100. The feed stores a 0–1 fraction; tolerate either. */
export function pctIn(live: LiveRace | undefined): number | undefined {
  const p = live?.pctExpected;
  if (p == null) return undefined;
  return p <= 1 ? p * 100 : p;
}

export function partyVar(p: Party | null | undefined): string {
  if (p === "D") return "var(--party-d)";
  if (p === "R") return "var(--party-r)";
  if (p == null) return "var(--uncalled)";
  return "var(--party-i)";
}

/** Mix a party colour toward the neutral "uncalled" grey; t ∈ [0,1], 1 = full party colour. */
function mixToward(p: Party | null, t: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, t)) * 100);
  return `color-mix(in oklch, ${partyVar(p)} ${pct}%, var(--uncalled))`;
}

const MARGIN_SATURATE_AT = 30; // points: ±30 or more renders the full party colour
const SWING_SATURATE_AT = 15;

/** Diverging fill for a D−R value; null when there is nothing to show. */
export function divergingFill(v: number | undefined, saturateAt: number): string | null {
  if (v == null || Number.isNaN(v)) return null;
  if (Math.abs(v) < 0.05) return "var(--uncalled)";
  const t = 0.18 + 0.82 * Math.min(1, Math.abs(v) / saturateAt);
  return mixToward(v > 0 ? "D" : "R", t);
}

export function ratingFill(r: RatingCode | undefined): string | null {
  if (!r) return null;
  const lean = RATING_LEAN[r];
  if (lean === "tossup") return "var(--uncalled)";
  const strength = r.startsWith("solid") ? 1 : r.startsWith("likely") ? 0.72 : r.startsWith("lean") ? 0.5 : 0.32;
  return mixToward(lean, strength);
}

export function statusFill(live: LiveRace | undefined, meta: RaceMeta | undefined): string | null {
  const { party, called } = seatLean(live, meta);
  if (party == null) return meta ? "var(--uncalled)" : null;
  return called ? partyVar(party) : mixToward(party, 0.5);
}

export function tileFill(mode: MapMode, live: LiveRace | undefined, meta: RaceMeta | undefined): string | null {
  switch (mode) {
    case "status":
      return statusFill(live, meta);
    case "margin":
      return divergingFill(liveMarginDR(live), MARGIN_SATURATE_AT);
    case "swing":
      return divergingFill(swingDR(live, meta), SWING_SATURATE_AT);
    case "ratings":
      return ratingFill(meta?.ratings.consensus);
  }
}

export function ratingRank(r: RatingCode | undefined): number {
  return r ? RATING_ORDER.indexOf(r) : RATING_ORDER.length;
}

export type HouseSummary = {
  bop: BalanceOfPower;
  /** Called + leaning per party. */
  dTotal: number;
  rTotal: number;
  /** Projected (called + leaning) minus seats currently held, per party. */
  netD: number;
  netR: number;
  heldD: number;
  heldR: number;
  tossup: number;
  calledCount: number;
};

/**
 * Balance of power derived from the 435 metas + whatever is live, so the header, cartogram and table always agree.
 * (The server payload also carries balance.house; it is absent before the first snapshot.)
 */
export function summarizeHouse(metas: RaceMeta[], live: Map<string, LiveRace>): HouseSummary {
  const called = { D: 0, R: 0, I: 0 };
  const leaning = { D: 0, R: 0, I: 0 };
  const ids = { calledD: [] as string[], calledR: [] as string[], calledI: [] as string[], uncalled: [] as string[] };
  let tossup = 0;
  let heldD = 0;
  let heldR = 0;
  for (const m of metas) {
    if (m.heldBy === "D") heldD++;
    else if (m.heldBy === "R") heldR++;
    const { party, called: isCalled } = seatLean(live.get(m.id), m);
    const bucket = party === "D" ? "D" : party === "R" ? "R" : party ? "I" : null;
    if (isCalled && bucket) {
      called[bucket]++;
      ids[`called${bucket}`].push(m.id);
      continue;
    }
    ids.uncalled.push(m.id);
    if (bucket) leaning[bucket]++;
    else tossup++;
  }
  const bop: BalanceOfPower = {
    office: "house",
    total: HOUSE_SEATS,
    majority: HOUSE_MAJORITY,
    notUp: { D: 0, R: 0, I: 0 },
    called,
    leaning,
    tossup,
    raceIds: ids,
  };
  const dTotal = called.D + leaning.D;
  const rTotal = called.R + leaning.R;
  return {
    bop,
    dTotal,
    rTotal,
    netD: dTotal - heldD,
    netR: rTotal - heldR,
    heldD,
    heldR,
    tossup,
    calledCount: called.D + called.R + called.I,
  };
}

/** "NC-01" from "house:NC-01". */
export function shortDistrict(id: string): string {
  return id.replace(/^house:/, "");
}

/** Sort key for poll-close times: 18:00 → 18, 00:00 → 24, 01:00 → 25. */
export function pollCloseSortKey(hhmm: string): number {
  const [h, m] = hhmm.split("/")[0].split(":").map(Number);
  const hour = h < 12 ? h + 24 : h;
  return hour + (m || 0) / 60;
}
