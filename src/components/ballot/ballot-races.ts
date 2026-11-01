/**
 * Pure helpers for the My Ballot page: the compact race index the server hands to the client, the contest-to-race
 * matching that links a Google Civic contest to its /race page, contest grouping, and small display helpers.
 * Type-only imports keep this module safe to bundle into client components.
 */
import type { Contest } from "@/lib/civic";

export type BallotOffice = "senate" | "governor" | "house" | "ballot";

/** What the server page passes down: race ids with pages, ballot-measure names, and state names. */
export interface BallotIndex {
  states: { abbr: string; name: string }[];
  /** Ids of every Senate, governor, House and statewide ballot-measure race in the reference data. */
  races: string[];
  /** Display names for ballot measures, keyed by race id (the other offices derive their label from the id). */
  measures: Record<string, string>;
}

export interface RaceRef {
  id: string;
  office: BallotOffice;
  state: string;
  /** House: "01".."53" or "AL". Ballot: the measure slug. */
  district?: string;
  special: boolean;
  /** Ballot measures only. */
  name?: string;
}

const OFFICES: ReadonlySet<string> = new Set<BallotOffice>(["senate", "governor", "house", "ballot"]);

export function buildBallotIndex(races: { id: string; office: string; name: string }[], states: { abbr: string; name: string }[]): BallotIndex {
  const kept = races.filter((r) => OFFICES.has(r.office));
  return {
    states: states.map((s) => ({ abbr: s.abbr, name: s.name })).sort((a, b) => a.name.localeCompare(b.name)),
    races: kept.map((r) => r.id),
    measures: Object.fromEntries(kept.filter((r) => r.office === "ballot").map((r) => [r.id, r.name])),
  };
}

/** "house:TX-15" -> { office: "house", state: "TX", district: "15" }; "senate:FL-special" -> special. */
export function parseRaceId(id: string, name?: string): RaceRef | undefined {
  const m = /^(senate|governor|house|ballot):([A-Z]{2})(?:-(.+))?$/.exec(id);
  if (!m) return undefined;
  const office = m[1] as BallotOffice;
  const rest = m[3];
  return {
    id,
    office,
    state: m[2],
    district: office === "house" || office === "ballot" ? rest : undefined,
    special: office === "senate" && rest === "special",
    name,
  };
}

export function expandIndex(index: BallotIndex): RaceRef[] {
  return index.races.flatMap((id) => parseRaceId(id, index.measures[id]) ?? []);
}

/** Same rule as `raceSlug` in components/race/race-content.ts: "senate:GA" -> "/race/senate-ga". */
export const raceHref = (id: string): string => `/race/${id.replace(":", "-").toLowerCase()}`;

// ---------- Contest -> race matching ----------

const LOCAL_LEVELS: ReadonlySet<string> = new Set(["administrativeArea2", "locality", "subLocality1", "subLocality2", "regional", "special"]);

/** Two-letter state of a contest: from its OCD division id, else the lookup's state. */
export function contestState(c: Contest, fallback?: string): string | undefined {
  const m = c.districtId ? /\/state:([a-z]{2})(?:\/|$)/i.exec(c.districtId) : null;
  const st = (m?.[1] ?? fallback)?.toUpperCase();
  return st && /^[A-Z]{2}$/.test(st) ? st : undefined;
}

/** Positive evidence that a contest covers the whole state (level, scope or OCD id), as opposed to unknown. */
export function isStatewide(c: Contest): boolean | undefined {
  if (c.level && LOCAL_LEVELS.has(c.level)) return false;
  if (c.districtId) return /\/state:[a-z]{2}$/i.test(c.districtId);
  if (c.scope) return c.scope === "statewide";
  if (c.level === "administrativeArea1") return true;
  return undefined;
}

function officeOf(c: Contest): BallotOffice | undefined {
  if (c.kind === "referendum") return "ballot";
  if (c.level && LOCAL_LEVELS.has(c.level)) return undefined;
  const t = c.title.toLowerCase().trim();
  // "Governor", "Governor and Lieutenant Governor"; never "Lieutenant Governor" or "Board of Governors".
  if (/^(state\s+)?governor\b/.test(t) && c.level !== "country") return "governor";
  const federal = c.level === "country" || /(?:^|[^a-z.])(?:u\.\s?s\.?|us|united states|federal)(?![a-z])/.test(t) || /\bcongress/.test(t);
  if (!federal || /\bstate\b/.test(t)) return undefined;
  if (/\bsenat/.test(t)) return "senate";
  if (/\brepresentative|\bhouse\b|\bcongress/.test(t)) return "house";
  return undefined;
}

/** Congressional district number from the OCD id, the district name or the office title. */
export function districtNumber(c: Contest): number | undefined {
  const cd = c.districtId ? /\/cd:(\d+)/.exec(c.districtId) : null;
  if (cd) return Number(cd[1]);
  for (const s of [c.district, c.title]) {
    if (!s) continue;
    const m =
      /(\d+)(?:st|nd|rd|th)?\s+(?:congressional\s+)?district/i.exec(s) ??
      /district\s*(?:no\.?\s*|#\s*)?(\d+)/i.exec(s) ??
      /\bcd[\s-]*(\d+)\b/i.exec(s) ??
      /\b[A-Z]{2}-(\d{1,2})\b/.exec(s);
    if (m) return Number(m[1]);
  }
  return undefined;
}

const KIND_GROUP: Record<string, string> = {
  "state question": "question",
  "public question": "question",
  "ballot question": "question",
  question: "question",
  "constitutional amendment": "amendment",
  "legislative amendment": "amendment",
  amendment: "amendment",
  proposition: "prop",
  propostion: "prop",
  prop: "prop",
  issue: "issue",
  "constitutional measure": "measure",
  "ballot measure": "measure",
  measure: "measure",
  proposal: "proposal",
  initiative: "initiative",
  referendum: "referendum",
};
/** Short codes that only count in capitals with a number ("HJR 4", "CI-132", "I-194"). */
const CODES = ["hjr", "sjr", "hcr", "scr", "ci", "cb", "lr", "i", "c"];
const DESIGNATION = new RegExp(
  `\\b(${[...Object.keys(KIND_GROUP), ...CODES].sort((a, b) => b.length - a.length).join("|")})\\.?(?:\\s+no\\.?)?(?:\\s*[-#]\\s*|\\s+)(\\d{1,4}[a-z]?|[a-z]{1,2})(?![a-z0-9])`,
  "gi",
);

/** Measure designations in a text, canonicalised: "Prop. 50" -> "prop:50", "State Question 845" -> "question:845". */
export function designations(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DESIGNATION)) {
    const [, kindRaw, des] = m;
    const kind = kindRaw.toLowerCase();
    const isCode = CODES.includes(kind);
    if (isCode && (kindRaw !== kindRaw.toUpperCase() || !/^\d/.test(des))) continue;
    // Letter designations ("Amendment J", "Proposition A") must be capitals, so "amendment to" never counts.
    if (/^[a-z]+$/i.test(des) && des !== des.toUpperCase()) continue;
    out.push(`${isCode ? kind : KIND_GROUP[kind]}:${des.toUpperCase().replace(/^0+(?=\d)/, "")}`);
  }
  return out;
}

const STOP = new Set(
  "a an and as at be by for from in into is it of on or than that the their this to with 2026 state states constitution constitutional amendment amendments measure initiative initiated proposition propostion prop question issue proposal referendum ballot legislative legislature act law statute statutory referred".split(
    " ",
  ),
);

function tokens(text: string, stateName?: string): Set<string> {
  const skip = new Set((stateName ?? "").toLowerCase().split(/\s+/));
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9%]+/)) {
    if (!raw || STOP.has(raw) || skip.has(raw) || /^\d+$/.test(raw)) continue;
    out.add(raw.length > 4 && raw.endsWith("s") ? raw.slice(0, -1) : raw);
  }
  return out;
}

function matchMeasure(c: Contest, pool: RaceRef[], stateName?: string): RaceRef | undefined {
  if (!pool.length || isStatewide(c) === false) return undefined;

  const wanted = designations(c.title);
  if (wanted.length) {
    const hits = pool.filter((r) => [...designations(r.name ?? ""), ...designations((r.district ?? "").replace(/-/g, " "))].some((d) => wanted.includes(d)));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return undefined;
  }

  // No designation in common: compare the meaningful words of the title (and a short subtitle) with each measure's name.
  const text = c.brief && c.brief.length <= 160 ? `${c.title} ${c.brief}` : c.title;
  const have = tokens(text, stateName);
  if (have.size < 2) return undefined;
  const scored = pool
    .map((r) => {
      const need = tokens(r.name ?? "", stateName);
      let shared = 0;
      for (const t of need) if (have.has(t)) shared++;
      return { r, shared, score: need.size ? shared / need.size : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  if (!best || best.shared < 2 || best.score < 0.6) return undefined;
  if (next && best.score - next.score < 0.15) return undefined;
  return best.r;
}

/**
 * The reference race a Google Civic contest refers to, or undefined when we are not confident. Federal and governor
 * contests match by state + office (+ district for the House, + special flag when a state has two Senate races);
 * statewide measures by state + designation ("Proposition 50"), falling back to a strict word overlap on the name.
 */
export function matchContest(c: Contest, races: RaceRef[], opts: { state?: string; stateName?: string } = {}): RaceRef | undefined {
  const st = contestState(c, opts.state);
  if (!st) return undefined;
  const office = officeOf(c);
  if (!office) return undefined;
  const pool = races.filter((r) => r.state === st && r.office === office);
  if (!pool.length) return undefined;

  if (office === "ballot") return matchMeasure(c, pool, opts.stateName);
  if (office === "governor") return pool[0];
  if (office === "senate") {
    if (pool.length === 1) return pool[0];
    const special = !!c.special || /\b(special|unexpired)\b/i.test(`${c.title} ${c.district ?? ""}`);
    return pool.find((r) => r.special === special);
  }
  if (pool.length === 1 && pool[0].district === "AL") return pool[0];
  const n = districtNumber(c);
  if (n === undefined) return undefined;
  return pool.find((r) => r.district === String(n).padStart(2, "0"));
}

// ---------- Contest grouping ----------

export type GroupKey = "federal" | "state" | "state-measures" | "county" | "local" | "local-measures" | "other" | "other-measures";

export const GROUP_LABEL: Record<GroupKey, string> = {
  federal: "Federal",
  state: "State",
  "state-measures": "Statewide ballot measures",
  county: "County",
  local: "Local",
  "local-measures": "Local ballot measures",
  other: "Other contests",
  "other-measures": "Other ballot measures",
};

const GROUP_ORDER: GroupKey[] = ["federal", "state", "state-measures", "county", "local", "local-measures", "other", "other-measures"];

function groupOf(c: Contest, matched: boolean): GroupKey {
  if (c.kind === "referendum") {
    const wide = matched || isStatewide(c);
    return wide === true ? "state-measures" : wide === false ? "local-measures" : "other-measures";
  }
  switch (c.level) {
    case "country":
      return "federal";
    case "administrativeArea1":
      return "state";
    case "administrativeArea2":
      return "county";
    case "locality":
    case "subLocality1":
    case "subLocality2":
    case "regional":
    case "special":
      return "local";
    default:
      return matched ? "federal" : "other";
  }
}

export interface ContestGroup<T> {
  key: GroupKey;
  label: string;
  items: T[];
}

/** Contests in ballot order within Federal, State, Statewide measures, County, Local, ... groups. */
export function groupContests<T extends { contest: Contest; race?: RaceRef }>(items: T[]): ContestGroup<T>[] {
  const by = new Map<GroupKey, T[]>();
  for (const it of items) {
    const k = it.race?.office === "governor" ? "state" : groupOf(it.contest, !!it.race);
    by.set(k, [...(by.get(k) ?? []), it]);
  }
  return GROUP_ORDER.filter((k) => by.has(k)).map((k) => ({ key: k, label: GROUP_LABEL[k], items: by.get(k)! }));
}

// ---------- Display ----------

const LEAD = /^((?:state |public |constitutional |legislative )?(?:proposition|propostion|amendment|question|issue|measure|proposal|initiative|referendum)\s+[\w-]+|(?:HJR|SJR|CI|CB|LR|I|C)[- ]\d+)(?:[,:]\s*|$)/i;

/** "Arizona Proposition 141, Prohibit Taxes…" -> { lead: "Proposition 141", rest: "Prohibit Taxes…" } for a list in Arizona. */
export function measureLabel(name: string, stateName: string): { lead?: string; rest: string } {
  const dropState = (s: string) => (s.toLowerCase().startsWith(`${stateName.toLowerCase()} `) ? s.slice(stateName.length + 1) : s);
  const s = dropState(name.replace(/^2026\s+/, "").trim());
  const m = LEAD.exec(s);
  // The designation must be a number ("Proposition 141", "CI-132") or one or two capitals ("Amendment J").
  const des = m?.[1].split(/[\s-]/).pop() ?? "";
  if (!m || !(/\d/.test(des) || /^[A-Z]{1,2}$/.test(des))) return { rest: s };
  const lead = m[1].replace(/^propostion\b/i, "Proposition");
  return { lead, rest: dropState(s.slice(m[0].length).trim()) };
}

const ORD = (n: number) => {
  const v = n % 100;
  return `${n}${v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

/** "15" -> "15th District", "AL" -> "At-large". */
export const districtLabel = (district: string): string => (district === "AL" ? "At-large" : `${ORD(Number(district))} District`);

/** Google Maps search for an address; opens the app on phones. */
export const directionsUrl = (address: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Only http(s) links from upstream data are rendered as hrefs. */
export function safeUrl(u: string): string | undefined {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : undefined;
  } catch {
    return undefined;
  }
}

/** "Democratic Party" -> "Democratic". */
export const partyLabel = (p?: string): string | undefined => p?.replace(/\s+party$/i, "").trim() || undefined;

/** State from the tail of a normalized address: "1 Main St, Austin, TX 78701" -> "TX". */
export function stateFromAddress(address?: string): string | undefined {
  const m = address ? /,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/.exec(address) : null;
  return m?.[1];
}

const HOUR = 3_600_000;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "2 days and 5 hours to go." until `start`; "today" between `start` and `end`; "past" after. */
export function countdownText(now: number, start: number, end: number): string {
  if (now >= end) return "past";
  if (now >= start) return "today";
  const hours = Math.floor((start - now) / HOUR);
  if (hours < 1) return "Less than an hour to go.";
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (!d) return `${plural(h, "hour")} to go.`;
  return h ? `${plural(d, "day")} and ${plural(h, "hour")} to go.` : `${plural(d, "day")} to go.`;
}

/**
 * A place's heading and street address. Google folds the location name into the address line
 * ("Central Library, 1 Margaret Mitchell Sq NW, Atlanta, GA 30303"), so a first part that doesn't start with a
 * number is taken as the name when the place has none of its own.
 */
export function splitPlace(p: { name?: string; address: string }): { title: string; address?: string } {
  const parts = p.address.split(", ");
  const lead = parts.length >= 3 && !/^\d/.test(parts[0]) ? parts[0] : undefined;
  const street = lead ? parts.slice(1).join(", ") : p.address;
  if (p.name) return { title: p.name, address: lead && lead === p.name ? street : p.address };
  return lead ? { title: lead, address: street } : { title: p.address };
}
