import type { CandidateResult, Party, RaceMeta } from "../../schema";

/**
 * Candidate identity across feeds.
 *
 * Each adapter sees a feed-specific spelling ("Roy A. Cooper", "COOPER, ROY",
 * "Amy Klobuchar and Ben Schierer"). We resolve it to the stable
 * `CandidateMeta.id` from the reference layer when possible, in this order:
 *   1. exact normalized match on name or any alias,
 *   2. unique last-name match (then last name + party when ambiguous),
 *   3. unique party match when both sides have exactly one candidate of that party (D/R only),
 *   4. fallback: deterministic slug of the feed name (`last-first`).
 * Write-in rows collapse to id `write-in`.
 */

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v", "esq", "md", "phd"]);

export function isWriteIn(name: string): boolean {
  return /\bwrite[\s-]*ins?\b/i.test(name) || /^wi$/i.test(name.trim());
}

/** "Peltola, Mary" → "Mary Peltola" (only for a single comma, no ticket separators). */
export function flipLastFirst(raw: string): string {
  const s = raw.trim();
  if ((s.match(/,/g) ?? []).length !== 1) return s;
  if (/\b(and|&)\b|\//.test(s)) return s;
  const [last, first] = s.split(",").map((p) => p.trim());
  if (!last || !first) return s;
  // "Sullivan, Daniel J. Jr." → "Daniel J. Sullivan Jr."
  const toks = first.split(/\s+/);
  const trailing = toks.filter((t) => SUFFIXES.has(t.toLowerCase().replace(/\./g, "")));
  const lead = toks.filter((t) => !SUFFIXES.has(t.toLowerCase().replace(/\./g, "")));
  return [...lead, last, ...trailing].join(" ");
}

/** First person on a ticket: "Amy Klobuchar and Ben Schierer" → "Amy Klobuchar". */
export function ticketHead(raw: string): string {
  return raw.split(/\s+(?:and|&)\s+|\s*\/\s*/i)[0]?.trim() ?? raw;
}

/** Lower-case, ASCII, no nicknames/parentheticals/punctuation/suffixes. */
export function normalizeName(raw: string): string {
  let s = ticketHead(flipLastFirst(raw));
  s = s.replace(/\([^)]*\)/g, " "); // "(Rep)", "(Incumbent)"
  s = s.replace(/["“”][^"“”]*["“”]/g, " "); // "Carol "Kitty" Hafner"
  s = s.replace(/'([^']{2,})'/g, " "); // 'Skip'
  s = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[^a-z0-9\s-]+/g, " ").replace(/-/g, " ");
  const toks = s.split(/\s+/).filter((t) => t && !SUFFIXES.has(t));
  return toks.join(" ");
}

export function lastNameOf(normalized: string): string {
  const toks = normalized.split(" ").filter(Boolean);
  return toks[toks.length - 1] ?? "";
}

export function firstNameOf(normalized: string): string {
  return normalized.split(" ").filter(Boolean)[0] ?? "";
}

/** Stable fallback id: "ossoff-jon" style (last-first). */
export function candidateSlug(raw: string): string {
  if (isWriteIn(raw)) return "write-in";
  const all = normalizeName(raw).split(" ").filter(Boolean);
  // Drop single-letter middle initials ("roy a cooper" → "cooper-roy") unless that is all there is.
  const toks = all.length === 1 ? all : all.filter((t) => t.length > 1);
  if (toks.length === 0) return slugify(raw) || "unknown";
  if (toks.length === 1) return toks[0] as string;
  const last = toks[toks.length - 1] as string;
  const first = toks[0] as string;
  return `${last}-${first}`;
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface FeedCandidate {
  name: string;
  party: Party;
  votes: number;
  incumbent?: boolean;
}

export type ResolvedCandidate = CandidateResult;

/**
 * Resolve a whole contest's candidate list against RaceMeta.
 * Returns one CandidateResult per feed row (same order), `pct` left at 0 —
 * `assembleRace` fills it.
 */
export function matchCandidates(feed: FeedCandidate[], meta: RaceMeta | undefined): ResolvedCandidate[] {
  const out: ResolvedCandidate[] = new Array(feed.length);
  const metaCands = meta?.candidates ?? [];
  const taken = new Set<string>();

  const normMeta = metaCands.map((c) => ({
    c,
    keys: new Set([c.name, ...c.aliases].map(normalizeName).filter(Boolean)),
    last: lastNameOf(normalizeName(c.name)),
  }));

  const assign = (i: number, id: string, name: string, party: Party, incumbent: boolean | undefined) => {
    const f = feed[i] as FeedCandidate;
    out[i] = { id, name, party, votes: f.votes, pct: 0, ...(incumbent !== undefined ? { incumbent } : {}) };
  };

  // Pass 0: write-ins.
  feed.forEach((f, i) => {
    if (isWriteIn(f.name)) assign(i, "write-in", "Write-in", "O", undefined);
  });

  // Pass 1: exact normalized name / alias.
  feed.forEach((f, i) => {
    if (out[i]) return;
    const n = normalizeName(f.name);
    const hit = normMeta.find((m) => !taken.has(m.c.id) && m.keys.has(n));
    if (hit) {
      taken.add(hit.c.id);
      assign(i, hit.c.id, hit.c.name, hit.c.party, hit.c.incumbent);
    }
  });

  // Pass 2: last name (unique), then last name + party.
  feed.forEach((f, i) => {
    if (out[i]) return;
    const last = lastNameOf(normalizeName(f.name));
    if (!last) return;
    let hits = normMeta.filter((m) => !taken.has(m.c.id) && m.last === last);
    if (hits.length > 1) hits = hits.filter((m) => m.c.party === f.party);
    const hit = hits.length === 1 ? hits[0] : undefined;
    if (hit) {
      taken.add(hit.c.id);
      assign(i, hit.c.id, hit.c.name, hit.c.party, hit.c.incumbent);
    }
  });

  // Pass 3: unique major-party match on both sides.
  feed.forEach((f, i) => {
    if (out[i]) return;
    if (f.party !== "D" && f.party !== "R") return;
    const feedSame = feed.filter((g, j) => !out[j] && g.party === f.party && !isWriteIn(g.name));
    const metaSame = normMeta.filter((m) => !taken.has(m.c.id) && m.c.party === f.party);
    if (feedSame.length === 1 && metaSame.length === 1) {
      const hit = metaSame[0] as (typeof normMeta)[number];
      taken.add(hit.c.id);
      assign(i, hit.c.id, hit.c.name, hit.c.party, hit.c.incumbent);
    }
  });

  // Pass 4: slug fallback.
  feed.forEach((f, i) => {
    if (out[i]) return;
    const pretty = ticketHead(flipLastFirst(f.name)).replace(/\s+\((?:Dem|Rep|Lib|Grn|Ind|[A-Z]{1,4})\)$/i, "").trim();
    assign(i, candidateSlug(f.name), pretty || f.name, f.party, f.incumbent);
  });

  return out;
}
