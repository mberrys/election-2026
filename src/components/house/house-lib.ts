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

const RAMP_BY_STRENGTH = { solid: 4, likely: 3, lean: 2, tilt: 1 } as const;
const HATCH = "hatch";

/** Margin ramp step for a value in points, with `saturateAt` mapped onto the landslide (20+) step. */
function rampFor(v: number, saturateAt: number): string {
  const m = (Math.abs(v) * 30) / saturateAt; // the ramp thresholds are set on a ±30 margin scale
  const step = m < 2 ? 1 : m < 5 ? 2 : m < 10 ? 3 : m < 20 ? 4 : 5;
  return `var(--ramp-${v > 0 ? "d" : "r"}-${step})`;
}

const MARGIN_SATURATE_AT = 30; // points
const SWING_SATURATE_AT = 15;

/** Diverging ramp fill for a D−R value; null (drawn hatched) when there is nothing to show. */
export function divergingFill(v: number | undefined, saturateAt: number): string | null {
  if (v == null || Number.isNaN(v)) return null;
  if (Math.abs(v) < 0.05) return "var(--s4)";
  return rampFor(v, saturateAt);
}

/** Neutral mid-grey for toss-ups in the ratings view: a forecast, not outstanding votes, so no hatch; mid-grey so the seats that matter most do not sink into the background. */
export const TOSSUP_FILL = "var(--ink-faint)";

/** Consensus rating on the ramp (tilt 1 … solid 4); toss-ups neutral. */
export function ratingFill(r: RatingCode | undefined): string | null {
  if (!r) return null;
  const lean = RATING_LEAN[r];
  if (lean === "tossup") return TOSSUP_FILL;
  const step = RAMP_BY_STRENGTH[r.split("-")[0] as keyof typeof RAMP_BY_STRENGTH];
  return `var(--ramp-${lean === "D" ? "d" : "r"}-${step})`;
}

function leaderParty(live: LiveRace | undefined): Party | undefined {
  if (!live || live.status !== "counting" || !live.totalVotes || !live.leaderId) return undefined;
  return live.candidates.find((c) => c.id === live.leaderId)?.party;
}

const TINT: Partial<Record<Party, string>> = { D: "var(--party-d-tint)", R: "var(--party-r-tint)" };

/**
 * Status in the Hatch grammar: projected = solid party; leading = dark party tint (the dot comes from tileMark);
 * otherwise hatched, in the rating's party colour when it leans, neutral for toss-ups.
 */
export function statusFill(live: LiveRace | undefined, meta: RaceMeta | undefined): string | null {
  if (live?.projection) return partyVar(live.projection.party);
  const lead = leaderParty(live);
  if (lead) return TINT[lead] ?? "var(--s4)";
  const { party } = seatLean(live, meta);
  if (party == null) return meta ? HATCH : null;
  return party === "D" ? "hatch-d" : party === "R" ? "hatch-r" : HATCH;
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

/** Status-mode marks: a full-colour dot on a leading seat, and the old holder's colour on a flipped one. */
export function tileMark(mode: MapMode, live: LiveRace | undefined, meta: RaceMeta | undefined): { dot?: string; flipFrom?: string } | null {
  if (mode !== "status") return null;
  const lead = live?.projection ? undefined : leaderParty(live);
  const winner = live?.projection?.party;
  const flipFrom = winner && meta?.heldBy && winner !== meta.heldBy ? partyVar(meta.heldBy) : undefined;
  if (!lead && !flipFrom) return null;
  return { dot: lead ? partyVar(lead) : undefined, flipFrom };
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

/** The last close of a split poll-close value ("19:00/20:00" → "20:00"), which is what `fmtEt` prints. */
export function lastClose(hhmm: string): string {
  return hhmm.split("/").pop() ?? hhmm;
}

/** Sort key for poll-close times (by the last close): 18:00 → 18, 00:00 → 24, 01:00 → 25. */
export function pollCloseSortKey(hhmm: string): number {
  const [h, m] = lastClose(hhmm).split(":").map(Number);
  const hour = h < 12 ? h + 24 : h;
  return hour + (m || 0) / 60;
}

/** Any House race has counted votes or a projection: the live map modes, table columns and legend marks apply. */
export function houseHasVotes(live: Map<string, LiveRace>): boolean {
  for (const r of live.values()) if (r.office === "house" && (r.projection || (r.totalVotes ?? 0) > 0)) return true;
  return false;
}

/** Map modes worth offering: before any vote only the ratings view has anything to show. */
export function availableModes(hasVotes: boolean): MapMode[] {
  return hasVotes ? MAP_MODES.map((m) => m.value) : ["ratings"];
}

export type LegendKey =
  | { kind: "swatch"; swatch: "projected-d" | "projected-r" | "leading-d" | "leading-r" | "lean-d" | "lean-r" | "uncounted"; label: string }
  | { kind: "fill"; fill: string; label: string }
  | { kind: "flip"; label: string };

const RATING_KEYS: { code: RatingCode; label: string }[] = [
  { code: "solid-d", label: "Solid D" },
  { code: "likely-d", label: "Likely D" },
  { code: "lean-d", label: "Lean D" },
  { code: "tilt-d", label: "Tilt D" },
  { code: "tossup", label: "Toss-up" },
  { code: "tilt-r", label: "Tilt R" },
  { code: "lean-r", label: "Lean R" },
  { code: "likely-r", label: "Likely R" },
  { code: "solid-r", label: "Solid R" },
];

/** Margin/swing ramp steps present, D landslide → R landslide, with their bucket labels for a given saturation. */
function rampKeys(values: number[], saturateAt: number, prefix: string): LegendKey[] {
  const k = saturateAt / 30;
  const edges = [2, 5, 10, 20].map((e) => +(e * k).toFixed(1));
  const bucket = (step: number) =>
    step === 1 ? `<${edges[0]}` : step === 5 ? `${edges[3]}+` : `${edges[step - 2]}–${edges[step - 1]}`;
  const present = new Set<string>();
  for (const v of values) if (Math.abs(v) >= 0.05) present.add(rampFor(v, saturateAt));
  const out: LegendKey[] = [];
  for (const side of ["d", "r"] as const) {
    const steps = side === "d" ? [5, 4, 3, 2, 1] : [1, 2, 3, 4, 5];
    for (const step of steps) {
      const fill = `var(--ramp-${side}-${step})`;
      if (present.has(fill)) out.push({ kind: "fill", fill, label: `${prefix}${side.toUpperCase()} ${bucket(step)}` });
    }
  }
  return out;
}

/**
 * Legend entries for the marks actually drawn in the current mode, D side first.
 * A key that no district currently shows is left out.
 */
export function legendKeys(mode: MapMode, metas: RaceMeta[], live: Map<string, LiveRace>): LegendKey[] {
  if (mode === "ratings") {
    const present = new Set(metas.map((m) => m.ratings.consensus).filter(Boolean));
    return RATING_KEYS.filter((k) => present.has(k.code)).map((k) => {
      const fill = ratingFill(k.code)!;
      return { kind: "fill", fill, label: k.label };
    });
  }
  if (mode === "status") {
    const seen = new Set<string>();
    let flip = false;
    for (const m of metas) {
      const lr = live.get(m.id);
      seen.add(statusFill(lr, m) ?? HATCH);
      if (tileMark(mode, lr, m)?.flipFrom) flip = true;
    }
    const order: [string, LegendKey][] = [
      ["var(--party-d)", { kind: "swatch", swatch: "projected-d", label: "D projected" }],
      [TINT.D!, { kind: "swatch", swatch: "leading-d", label: "D leads" }],
      ["hatch-d", { kind: "swatch", swatch: "lean-d", label: "Uncalled, rated D" }],
      [HATCH, { kind: "swatch", swatch: "uncounted", label: "Uncalled toss-up" }],
      ["hatch-r", { kind: "swatch", swatch: "lean-r", label: "Uncalled, rated R" }],
      [TINT.R!, { kind: "swatch", swatch: "leading-r", label: "R leads" }],
      ["var(--party-r)", { kind: "swatch", swatch: "projected-r", label: "R projected" }],
    ];
    const out = order.filter(([f]) => seen.has(f)).map(([, k]) => k);
    if (flip) out.push({ kind: "flip", label: "Flipped (marker in old holder's colour)" });
    return out;
  }
  const values: number[] = [];
  let missing = false;
  let even = false;
  for (const m of metas) {
    const v = mode === "margin" ? liveMarginDR(live.get(m.id)) : swingDR(live.get(m.id), m);
    if (v == null || Number.isNaN(v)) missing = true;
    else if (Math.abs(v) < 0.05) even = true;
    else values.push(v);
  }
  const out = rampKeys(values, mode === "margin" ? MARGIN_SATURATE_AT : SWING_SATURATE_AT, mode === "swing" ? "→" : "");
  if (even) {
    const firstR = out.findIndex((k) => k.kind === "fill" && k.fill.includes("-r-"));
    out.splice(firstR === -1 ? out.length : firstR, 0, { kind: "fill", fill: "var(--s4)", label: "Even" });
  }
  if (missing) out.push({ kind: "swatch", swatch: "uncounted", label: "No votes yet" });
  return out;
}
