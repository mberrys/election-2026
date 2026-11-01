import type { Party, Race, RaceMeta, RatingCode, StateMeta } from "@/data/schema";

export type LiveRace = Omit<Race, "units">;

export type ChamberKind = "upper" | "lower" | "unicameral";

export type ChamberControl = {
  party: Party | null; // null = coalition / tied / unknown
  called: boolean;
  label: string; // "D", "R", "Coal.", "Tied"
};

/** stateleg:XX-senate → upper; house/assembly → lower; legislature (Nebraska) → unicameral. */
export function chamberKind(meta: RaceMeta): ChamberKind {
  const d = (meta.district ?? "").toLowerCase();
  if (d === "senate") return "upper";
  if (d === "legislature") return "unicameral";
  return "lower";
}

export function chamberName(meta: RaceMeta): string {
  const d = (meta.district ?? "").toLowerCase();
  return d === "legislature" ? "Legislature" : d.charAt(0).toUpperCase() + d.slice(1);
}

/** "Current composition: R 77–28" → "R 77–28"; other notes are returned trimmed to one sentence. */
export function composition(meta: RaceMeta): string | undefined {
  const n = meta.notes;
  if (!n) return undefined;
  const m = /Current composition:\s*(.+)$/i.exec(n);
  return (m ? m[1] : n.split(". ")[0]).trim();
}

export function chamberControl(live: LiveRace | undefined, meta: RaceMeta): ChamberControl {
  if (live?.projection) {
    const p = live.projection.party;
    return { party: p === "D" || p === "R" ? p : null, called: true, label: p };
  }
  if (meta.heldBy === "D" || meta.heldBy === "R") return { party: meta.heldBy, called: false, label: meta.heldBy };
  const comp = composition(meta) ?? "";
  if (/coal/i.test(comp)) return { party: null, called: false, label: "Coal." };
  if (/(\d+)–\1/.test(comp)) return { party: null, called: false, label: "Tied" };
  return { party: null, called: false, label: "—" };
}

/** Projected control is the full party colour; control going in is one ramp step deeper, so a projection reads as new. */
export function controlFill(c: ChamberControl | undefined): string {
  if (!c) return "transparent";
  if (c.called) return c.party === "D" ? "var(--party-d)" : c.party === "R" ? "var(--party-r)" : "var(--party-i)";
  if (c.party === "D") return "var(--ramp-d-3)";
  if (c.party === "R") return "var(--ramp-r-3)";
  return "color-mix(in oklch, var(--party-i) 42%, var(--s2))";
}

/** Strip the "(Source: …)" suffix the reference builder appends to measure descriptions. */
export function measureDescription(meta: RaceMeta): string | undefined {
  const n = meta.notes?.replace(/\s*\(Source:[^)]*\)\s*$/i, "").trim();
  return n || undefined;
}

export function ballotpediaUrl(stateName: string): string {
  return `https://ballotpedia.org/${stateName.replace(/ /g, "_")}_2026_ballot_measures`;
}

export type YesNo = { yes?: number; no?: number; yesVotes?: number; noVotes?: number };

export function yesNo(live: LiveRace | undefined): YesNo | undefined {
  if (!live || !live.candidates.length) return undefined;
  const y = live.candidates.find((c) => /^yes\b/i.test(c.name) || /^for\b/i.test(c.name));
  const n = live.candidates.find((c) => /^no\b/i.test(c.name) || /^against\b/i.test(c.name));
  if (!y && !n) return undefined;
  return { yes: y?.pct, no: n?.pct, yesVotes: y?.votes, noVotes: n?.votes };
}

// ---------- Seats ----------

export type SeatSegment = { key: "D" | "R" | "O" | "coalition" | "opposition" | "tied"; n: number; label: string };

export type SeatSplit = {
  segments: SeatSegment[];
  total: number;
  majority: number;
  /** Party that holds the majority going in; null for coalitions and ties. */
  lead: "D" | "R" | null;
  /** Seats the majority can lose and still hold control; null for a tie. */
  spare: number | null;
};

/**
 * Parse "R 77–28", "D 76–73–2", "Coal. 21–19 (…)" or "67–67 (…)" into seat segments.
 * Returns undefined when the note carries no seat counts (Nebraska).
 */
export function seatSplit(meta: RaceMeta): SeatSplit | undefined {
  const comp = composition(meta);
  if (!comp) return undefined;
  const m = /^(D|R|Coal\.)?\s*(\d+(?:–\d+)+)/.exec(comp);
  if (!m) return undefined;
  const nums = m[2].split("–").map(Number);
  const total = nums.reduce((a, b) => a + b, 0);
  const majority = Math.floor(total / 2) + 1;
  const prefix = m[1];
  if (prefix === "D" || prefix === "R") {
    const other = prefix === "D" ? "R" : "D";
    const segments: SeatSegment[] = [
      { key: prefix, n: nums[0], label: prefix === "D" ? "Democrats" : "Republicans" },
      { key: other, n: nums[1] ?? 0, label: other === "D" ? "Democrats" : "Republicans" },
    ];
    const rest = nums.slice(2).reduce((a, b) => a + b, 0);
    if (rest) segments.push({ key: "O", n: rest, label: "Other" });
    return { segments, total, majority, lead: prefix, spare: nums[0] - majority };
  }
  if (prefix === "Coal.")
    return {
      segments: [
        { key: "coalition", n: nums[0], label: "Coalition" },
        { key: "opposition", n: nums.slice(1).reduce((a, b) => a + b, 0), label: "Opposition" },
      ],
      total,
      majority,
      lead: null,
      spare: nums[0] - majority,
    };
  return { segments: nums.map((n) => ({ key: "tied" as const, n, label: "Tied" })), total, majority, lead: null, spare: null };
}

export function segmentFill(key: SeatSegment["key"]): string {
  switch (key) {
    case "D":
      return "var(--party-d)";
    case "R":
      return "var(--party-r)";
    case "coalition":
      return "var(--party-i)";
    case "tied":
      return "var(--ink-faint)";
    default:
      return "var(--s4)";
  }
}

// ---------- Per-state view model ----------

export type Chamber = {
  meta: RaceMeta;
  name: string;
  control: ChamberControl;
  live?: LiveRace;
  split?: SeatSplit;
  rating?: RatingCode;
  inPlay: boolean;
};

export type StateEntry = {
  st: string;
  name: string;
  meta?: StateMeta;
  upper?: Chamber;
  lower?: Chamber;
  uni?: Chamber;
  governor?: { meta: RaceMeta; live?: LiveRace };
  measures: RaceMeta[];
};

/** Every state with a chamber, a governor race or a measure on the 2026 ballot, keyed by abbreviation. */
export function buildEntries(
  legs: RaceMeta[],
  governors: RaceMeta[],
  measures: RaceMeta[],
  states: StateMeta[],
  live: Map<string, LiveRace>,
): Map<string, StateEntry> {
  const meta = new Map(states.map((s) => [s.abbr, s]));
  const map = new Map<string, StateEntry>();
  const get = (st: string) => {
    let e = map.get(st);
    if (!e) {
      e = { st, name: meta.get(st)?.name ?? st, meta: meta.get(st), measures: [] };
      map.set(st, e);
    }
    return e;
  };
  for (const m of legs) {
    const lr = live.get(m.id);
    const c: Chamber = { meta: m, name: chamberName(m), control: chamberControl(lr, m), live: lr, split: seatSplit(m), rating: m.ratings.consensus, inPlay: inPlay(m) };
    const kind = chamberKind(m);
    get(m.state)[kind === "unicameral" ? "uni" : kind] = c;
  }
  for (const g of governors) get(g.state).governor = { meta: g, live: live.get(g.id) };
  for (const m of measures) get(m.state).measures.push(m);
  for (const e of map.values()) e.measures.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  return map;
}

/** Rated toss-up, tilt or lean by the consensus forecast: control is contested. */
export function inPlay(meta: RaceMeta): boolean {
  const r = meta.ratings.consensus;
  return !!r && (r === "tossup" || r.startsWith("tilt") || r.startsWith("lean"));
}

// ---------- Measures ----------

const TAGS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(?:Proposition|Propostion|Prop\.?)\s+([\w-]+)[:,]\s*/i, (m) => `Prop ${m[1]}`],
  [/^State Question\s+([\w-]+),\s*/i, (m) => `State Question ${m[1]}`],
  [/^Public Question\s+([\w-]+),\s*/i, (m) => `Public Question ${m[1]}`],
  [/^Constitutional Amendment\s+([\w-]+),\s*/i, (m) => `Amendment ${m[1]}`],
  [/^Constitutional Measure\s+([\w-]+),\s*/i, (m) => `Measure ${m[1]}`],
  [/^(Question|Amendment|Issue|Proposal|Initiative)\s+([\w-]+),?\s*/i, (m) => `${m[1]} ${m[2]}`],
  [/^(HJR\s+\d+|CI-\d+|I-\d+),\s*/i, (m) => m[1]],
];

const KINDS: [RegExp, string][] = [
  [/\s+Bond (?:Measure|Issue)$/i, "Bond"],
  [/\s+Constitutional Amendment$/i, "Amendment"],
  [/\s+Amendment$/i, "Amendment"],
  [/\s+Initiative$/i, "Initiative"],
  [/\s+Referendum$/i, "Referendum"],
  [/\s+Measure$/i, "Measure"],
];

export type MeasureParts = { tag?: string; title: string; kind?: string };

/** "Arizona Proposition 141, Prohibit Taxes … Amendment" → { tag: "Prop 141", title: "Prohibit Taxes …", kind: "Amendment" }. */
export function measureParts(meta: RaceMeta, stateName: string): MeasureParts {
  let s = meta.name.replace(/^20\d\d\s+/, "").trim();
  const stripState = () => {
    if (s.toLowerCase().startsWith(`${stateName.toLowerCase()} `)) s = s.slice(stateName.length + 1);
  };
  stripState();
  let tag: string | undefined;
  for (const [re, fmt] of TAGS) {
    const m = re.exec(s);
    if (!m) continue;
    tag = fmt(m);
    s = s.slice(m[0].length);
    break;
  }
  stripState();
  let kind: string | undefined;
  for (const [re, k] of KINDS) {
    if (re.test(s)) {
      kind = k;
      s = s.replace(re, "");
      break;
    }
  }
  // Source titles are cut at a fixed length ("… Policies Am…"); drop the broken word.
  s = s.replace(/\s+\S{1,3}…$/, "…").trim();
  if (!s) return { title: tag ?? meta.name, kind };
  return { tag, title: s.charAt(0).toUpperCase() + s.slice(1), kind };
}

export const TOPICS = [
  { id: "elections", label: "Elections & voting", re: /\bvot(?:e|er|ers|ing)\b(?![- ]approv)|election|primary election|primaries|citizenship|redistricting|congressional map|ranked-choice|campaign|recall|ballot (?:initiative|measure)s?|initiative and referendum|constitutional (?:amendments?|convention)|plain language|registration/i },
  { id: "taxes", label: "Taxes & budget", re: /\btax|revenue|budget|spending|tabor|gann|\bfees?\b|\bfund\b|retirement system|liability/i },
  { id: "bonds", label: "Bonds", re: /\bbonds?\b/i },
  { id: "rights", label: "Rights & social issues", re: /abortion|reproductive|same-sex|marriage|equal protection|gender|sex requirement|discrimination|preferential|race- or ethnicity|places of worship|prayer|pledge|star-spangled|english as official|private spaces|parental right/i },
  { id: "crime", label: "Crime & courts", re: /\bbail|judicial|judges?\b|court|criminal|fentanyl|prison|trafficking|crime|pardon|sheriff|cartel|probate|victims|traffic enforcement|homeland security/i },
  { id: "education", label: "Education", re: /school|education|college|students?\b|instruction|regents|library/i },
  { id: "guns", label: "Guns & hunting", re: /\barms\b|firearm|\bgun\b|\bhunt/i },
  { id: "government", label: "Government & officials", re: /legislat(?:ure|ive|ors)|governor|veto|public records|collective bargaining|state officer|term limits|salary|state employees/i },
  { id: "housing", label: "Housing & property", re: /housing|homestead|homebuyer|mortgage|lot size|property|residence/i },
  { id: "health", label: "Health", re: /health|medicaid|immunolog|surger/i },
  { id: "environment", label: "Environment & land", re: /environment|watershed|conservation|natural (?:resources|gas)|nature|wildfire|drinking water|agricultur|timber|\bfish/i },
  { id: "vices", label: "Marijuana & gambling", re: /marijuana|narcotics|wagering|sports betting|psychoactive/i },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

/** Keyword topics for filtering; a measure can carry several. Matched on the title, or the summary when the title says nothing ("Proposal 2"). */
export function measureTopics(meta: RaceMeta): TopicId[] {
  const match = (text: string) => TOPICS.filter((t) => t.re.test(text)).map((t) => t.id);
  const byName = match(meta.name);
  return byName.length ? byName : match(measureDescription(meta) ?? "");
}
