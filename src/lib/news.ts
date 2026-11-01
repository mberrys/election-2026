/**
 * Per-race rolling news: builds a precise search from reference data, asks GDELT DOC 2.0, falls back to
 * Google News RSS, then filters, de-duplicates and sorts the headlines. Server-safe (no React, no Next imports).
 * Nothing here throws to the caller: total failure is `source: "none"` with no items.
 */
import type { CandidateMeta, RaceMeta } from "@/data/schema";

export type NewsItem = { title: string; url: string; outlet: string; publishedAt: string /* ISO */ };
export type NewsPayload = {
  raceId: string;
  items: NewsItem[];
  source: "gdelt" | "google-news" | "none";
  fetchedAt: string;
  query: string;
};

const MAX_ITEMS = 20;
/** GDELT routinely takes 5-10 s; a timeout also starts the cool-down so later requests go straight to Google News. */
const GDELT_TIMEOUT_MS = 8_000;
const GOOGLE_TIMEOUT_MS = 5_000;
/** GDELT asks for at most one request per 5 s per client; after a 429 we skip it for a minute. */
const GDELT_MIN_GAP_MS = 5_500;
const GDELT_BACKOFF_MS = 60_000;
/** Start Google News in parallel when GDELT has not answered after this long. */
const HEDGE_MS = 3_500;
const USER_AGENT = "Mozilla/5.0 (compatible; BigBoard2026/0.1; +https://github.com/) news-feed";

// ---------------------------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------------------------

type QueryPlan = { query: string; mustMatch: string[]; minMatches: number };

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const SURNAME_PARTICLES = new Set(["de", "la", "le", "del", "della", "di", "da", "van", "von", "der", "den", "st.", "mc", "mac"]);

const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
};

const clean = (s: string): string => s.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
const quote = (s: string): string => `"${clean(s)}"`;
const orGroup = (terms: string[]): string => (terms.length === 1 ? (terms[0] as string) : `(${terms.join(" OR ")})`);

/** "Monica De La Cruz" -> "De La Cruz"; "Jon Ossoff Jr." -> "Ossoff". Empty when no usable surname. */
export function surnameOf(fullName: string): string {
  const tokens = clean(fullName).split(" ").filter((t) => t && !NAME_SUFFIX.test(t));
  if (tokens.length < 2) return "";
  let start = tokens.length - 1;
  while (start > 1 && SURNAME_PARTICLES.has((tokens[start - 1] as string).toLowerCase())) start--;
  const surname = tokens.slice(start).join(" ");
  return surname.replace(/[^A-Za-z]/g, "").length >= 3 ? surname : "";
}

/** The D and R nominees (incumbent first); minor-party candidates only when they are the incumbent. */
export function mainNominees(candidates: CandidateMeta[]): CandidateMeta[] {
  const pick = (party: "D" | "R") => {
    const ofParty = candidates.filter((c) => c.party === party);
    return ofParty.find((c) => c.incumbent) ?? ofParty[0];
  };
  const picked = [pick("D"), pick("R")].filter((c): c is CandidateMeta => Boolean(c));
  const otherIncumbent = candidates.find((c) => c.incumbent && c.party !== "D" && c.party !== "R");
  if (otherIncumbent) picked.push(otherIncumbent);
  if (picked.length === 0) picked.push(...candidates.slice(0, 2));
  return picked.sort((a, b) => Number(Boolean(b.incumbent)) - Number(Boolean(a.incumbent)));
}

function candidateTerms(nominees: CandidateMeta[]): string[] {
  const terms: string[] = [];
  for (const c of nominees) {
    terms.push(clean(c.name), ...c.aliases.map(clean));
    const surname = surnameOf(c.name);
    if (surname) terms.push(surname);
  }
  return [...new Set(terms.filter(Boolean))];
}

const BALLOT_KIND_RE =
  /\b(Proposition|Proposal|Question|Amendment|Issue|Measure|Initiative|Referendum|Prop|HJR|SJR|CI|IM|I)[\s-]+(\d{1,3}|[A-Z])\b/;

/** The measure's own label ("Proposition 3", "Amendment 81", "CI-132"), if the title carries one. */
export function ballotDesignator(title: string): { label: string; variants: string[] } | null {
  const m = BALLOT_KIND_RE.exec(title);
  if (!m) return null;
  const [, kind, id] = m as unknown as [string, string, string];
  if (kind === "Proposition" || kind === "Prop") {
    return { label: `Proposition ${id}`, variants: [`Proposition ${id}`, `Prop ${id}`, `Prop. ${id}`] };
  }
  if (kind === "HJR" || kind === "SJR" || kind === "CI" || kind === "IM" || kind === "I") {
    const hyphen = `${kind}-${id}`;
    return { label: hyphen, variants: [hyphen, `${kind} ${id}`] };
  }
  return { label: `${kind} ${id}`, variants: [`${kind} ${id}`] };
}

const TITLE_STOPWORDS = new Set(
  (
    "a an the of to for and in on or by with at from as into than that this its their per not no be is are " +
    "amendment initiative measure referendum bond bonds issue question constitutional state public proposal proposition " +
    "require requires required requirement requirements allow allows authorize authorizing establish change changes increase " +
    "provide provides create creation remove removing eliminate limit limits permit repeal raise use retain reduce alter add " +
    "grant exclude abolish prohibit new certain based existing one time"
  ).split(" "),
);

/** Up to four distinctive words from an unnumbered measure's title, in order. */
export function titleKeywords(name: string, stateName: string): string[] {
  const withoutState = name.replace(new RegExp(`^(?:20\\d\\d\\s+)?${stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "");
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of withoutState.match(/[A-Za-z][A-Za-z'’-]+/g) ?? []) {
    const w = raw.replace(/['’]s$/i, "").toLowerCase();
    if (w.length < 3 || TITLE_STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
    if (words.length === 4) break;
  }
  return words;
}

function planFor(meta: RaceMeta, stateName: string): QueryPlan {
  const state = clean(stateName) || meta.state;

  if (meta.office === "ballot") {
    const designator = ballotDesignator(meta.name);
    if (designator) {
      const phrases = designator.variants.filter((v) => !v.includes("."));
      return { query: `${orGroup(phrases.map(quote))} ${quote(state)}`, mustMatch: designator.variants, minMatches: 1 };
    }
    const words = titleKeywords(meta.name, state);
    if (words.length === 0) return { query: `${quote(state)} ${quote(clean(meta.name))}`, mustMatch: [clean(meta.name)], minMatches: 1 };
    const distinctive = [...words].sort((a, b) => b.length - a.length).slice(0, 3);
    return {
      query: `${quote(state)} ${words.join(" ")} ballot`,
      mustMatch: distinctive,
      minMatches: distinctive.length >= 3 ? 2 : 1,
    };
  }

  if (meta.office === "stateleg") {
    const chamber = meta.district === "senate" ? "Senate" : "House";
    return { query: `${quote(state)} legislature ${chamber} election`, mustMatch: [state], minMatches: 1 };
  }

  const nominees = mainNominees(meta.candidates);
  const names = nominees.map((c) => quote(c.name));
  const mustMatch = candidateTerms(nominees);
  const who = names.length ? orGroup(names) : "";

  if (meta.office === "house") {
    const dist = (meta.district ?? "").toUpperCase();
    const number = /^\d+$/.test(dist) ? Number(dist) : null;
    const labels =
      number !== null
        ? [quote(`${meta.state}-${number}`), quote(`${ordinal(number)} District`)]
        : [quote(`${meta.state}-AL`), quote("at-large district")];
    const where = orGroup([quote(state), ...labels]);
    const query = who ? `${who} ${where}` : `${where} congressional election`;
    return { query, mustMatch: mustMatch.length ? mustMatch : [state], minMatches: 1 };
  }

  const office = meta.office === "senate" ? "Senate" : "governor";
  const query = who ? `${who} ${quote(state)} ${office}` : `${quote(state)} ${office} race`;
  return { query, mustMatch: mustMatch.length ? mustMatch : [state], minMatches: 1 };
}

/** Search text plus the terms a headline must contain (at least one) to count as on-topic. */
export function newsQueryFor(meta: RaceMeta, stateName: string): { query: string; mustMatch: string[] } {
  const { query, mustMatch } = planFor(meta, stateName);
  return { query, mustMatch };
}

// ---------------------------------------------------------------------------------------------
// Parsing and filtering
// ---------------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const tagText = (xml: string, tag: string): string => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  if (!m) return "";
  const body = (m[1] as string).trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(body);
  return decodeEntities((cdata ? (cdata[1] as string) : body).trim()).replace(/\s+/g, " ").trim();
};

/** Strip the " - Outlet" suffix Google News appends to titles. */
export function stripOutletSuffix(title: string, outlet: string): string {
  const t = title.trim();
  if (outlet && t.toLowerCase().endsWith(` - ${outlet.toLowerCase()}`)) return t.slice(0, t.length - outlet.length - 3).trim();
  return t;
}

/** Parse a Google News RSS search feed with no XML dependency. Items without a title, link or valid date are dropped. */
export function parseGoogleNewsRss(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = m[1] as string;
    const outlet = tagText(block, "source");
    const rawTitle = tagText(block, "title");
    const url = tagText(block, "link");
    const time = Date.parse(tagText(block, "pubDate"));
    if (!rawTitle || !/^https?:\/\//i.test(url) || Number.isNaN(time)) continue;
    let title = stripOutletSuffix(rawTitle, outlet);
    let name = outlet;
    if (!name) {
      // No <source>: fall back to the last " - X" segment.
      const i = title.lastIndexOf(" - ");
      if (i > 0 && title.length - i - 3 <= 40) {
        name = title.slice(i + 3).trim();
        title = title.slice(0, i).trim();
      }
    }
    if (!title) continue;
    out.push({ title, url, outlet: name || hostOf(url), publishedAt: new Date(time).toISOString() });
  }
  return out;
}

const OUTLETS: Record<string, string> = {
  "nytimes.com": "The New York Times",
  "washingtonpost.com": "The Washington Post",
  "wsj.com": "The Wall Street Journal",
  "cnn.com": "CNN",
  "foxnews.com": "Fox News",
  "nbcnews.com": "NBC News",
  "cbsnews.com": "CBS News",
  "abcnews.go.com": "ABC News",
  "apnews.com": "The Associated Press",
  "reuters.com": "Reuters",
  "politico.com": "Politico",
  "thehill.com": "The Hill",
  "axios.com": "Axios",
  "npr.org": "NPR",
  "usatoday.com": "USA Today",
  "newsweek.com": "Newsweek",
  "ajc.com": "Atlanta Journal-Constitution",
  "bloomberg.com": "Bloomberg",
  "latimes.com": "Los Angeles Times",
  "msnbc.com": "MSNBC",
  "cnbc.com": "CNBC",
  "foxbusiness.com": "Fox Business",
  "washingtonexaminer.com": "Washington Examiner",
  "nypost.com": "New York Post",
  "dailycaller.com": "Daily Caller",
  "breitbart.com": "Breitbart",
  "huffpost.com": "HuffPost",
  "theguardian.com": "The Guardian",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m|amp)\./, "");
  } catch {
    return "";
  }
}

/** Display name for a domain: known outlets by name, otherwise the bare domain. */
export function outletForDomain(domain: string): string {
  const d = domain.toLowerCase().replace(/^(www|m|amp)\./, "");
  return OUTLETS[d] ?? d;
}

/** "20261031T123000Z" -> ISO string, or null. */
function gdeltDate(s: unknown): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(s ?? ""));
  if (!m) return null;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function parseGdelt(json: unknown): NewsItem[] {
  const articles = (json as { articles?: unknown } | null)?.articles;
  if (!Array.isArray(articles)) return [];
  const out: NewsItem[] = [];
  for (const a of articles as Record<string, unknown>[]) {
    // GDELT tokenises punctuation ("Obama , in Midwest ,"): close the gaps.
    const title = typeof a.title === "string" ? decodeEntities(a.title).replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim() : "";
    const url = typeof a.url === "string" ? a.url : "";
    const publishedAt = gdeltDate(a.seendate);
    if (!title || !/^https?:\/\//i.test(url) || !publishedAt) continue;
    const domain = typeof a.domain === "string" && a.domain ? a.domain : hostOf(url);
    out.push({ title, url, outlet: outletForDomain(domain), publishedAt });
  }
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-term, case-insensitive containment ("Prop 3" does not match "Prop 30"). */
export function titleHasTerm(title: string, term: string): boolean {
  if (!term) return false;
  const pattern = term.trim().split(/[\s-]+/).map(escapeRe).join("[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu").test(title);
}

/** Keep headlines containing at least `min` distinct mustMatch terms. An empty list keeps everything. */
export function filterByMustMatch(items: NewsItem[], mustMatch: string[], min = 1): NewsItem[] {
  if (mustMatch.length === 0) return items;
  return items.filter((it) => mustMatch.filter((t) => titleHasTerm(it.title, t)).length >= min);
}

const normalizeTitle = (t: string): string =>
  t
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Drop near-identical headlines (syndicated copies, "Updated:" rewrites). Input order decides which copy survives. */
export function dedupeItems(items: NewsItem[], threshold = 0.8): NewsItem[] {
  const kept: { item: NewsItem; tokens: Set<string>; url: string }[] = [];
  for (const item of items) {
    const tokens = new Set(normalizeTitle(item.title).split(" ").filter(Boolean));
    const dup = kept.some((k) => {
      if (k.url === item.url) return true;
      let shared = 0;
      for (const t of tokens) if (k.tokens.has(t)) shared++;
      const union = tokens.size + k.tokens.size - shared;
      return union > 0 && shared / union >= threshold;
    });
    if (!dup) kept.push({ item, tokens, url: item.url });
  }
  return kept.map((k) => k.item);
}

/** Filter, sort newest first, de-duplicate, cap. Exported for tests. */
export function refineItems(items: NewsItem[], mustMatch: string[], minMatches = 1, now = Date.now()): NewsItem[] {
  const fresh = items.filter((i) => Date.parse(i.publishedAt) <= now + 24 * 3600_000);
  const sorted = [...filterByMustMatch(fresh, mustMatch, minMatches)].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  return dedupeItems(sorted).slice(0, MAX_ITEMS);
}

// ---------------------------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------------------------

type FetchFn = typeof fetch;

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

let gdeltNextAllowedAt = 0;

async function fetchGdelt(query: string, doFetch: FetchFn, now: number): Promise<NewsItem[]> {
  if (now < gdeltNextAllowedAt) throw new UpstreamError("gdelt cooling down", 429);
  gdeltNextAllowedAt = now + GDELT_MIN_GAP_MS;
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `${query} sourcelang:english sourcecountry:US`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "50");
  url.searchParams.set("timespan", "14d");
  url.searchParams.set("sort", "datedesc");
  let res: Response;
  try {
    res = await doFetch(url, { cache: "no-store", headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(GDELT_TIMEOUT_MS) });
  } catch (e) {
    gdeltNextAllowedAt = now + GDELT_BACKOFF_MS;
    throw e;
  }
  if (res.status === 429) {
    gdeltNextAllowedAt = now + GDELT_BACKOFF_MS;
    throw new UpstreamError("gdelt rate limited", 429);
  }
  if (!res.ok) throw new UpstreamError(`gdelt http ${res.status}`, res.status);
  const text = (await res.text()).trim();
  // An empty body is GDELT's "no matches"; anything else that is not JSON (query errors, throttle notices) is a failure.
  if (!text) return [];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    if (/limit requests|too many/i.test(text)) gdeltNextAllowedAt = now + GDELT_BACKOFF_MS;
    throw new UpstreamError("gdelt non-json response");
  }
  return parseGdelt(json);
}

async function fetchGoogleNews(query: string, doFetch: FetchFn): Promise<NewsItem[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:14d`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  const res = await doFetch(url, { cache: "no-store", headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
  if (!res.ok) throw new UpstreamError(`google news http ${res.status}`, res.status);
  return parseGoogleNewsRss(await res.text());
}

/** Headlines for one race. Never throws; `source: "none"` with an empty list means nothing could be fetched. */
export async function fetchRaceNews(
  meta: RaceMeta,
  stateName: string,
  opts: { fetch?: FetchFn; now?: number } = {},
): Promise<NewsPayload> {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now();
  let plan: QueryPlan;
  try {
    plan = planFor(meta, stateName);
  } catch {
    return { raceId: meta.id, items: [], source: "none", fetchedAt: new Date(now).toISOString(), query: "" };
  }
  const done = (source: NewsPayload["source"], items: NewsItem[]): NewsPayload => ({
    raceId: meta.id,
    items,
    source,
    fetchedAt: new Date().toISOString(),
    query: plan.query,
  });

  const refine = (items: NewsItem[]) => refineItems(items, plan.mustMatch, plan.minMatches, now);
  const attempt = (source: "gdelt" | "google-news", run: () => Promise<NewsItem[]>) =>
    run().then(
      (items) => ({ source, items: refine(items) }),
      () => ({ source, items: [] as NewsItem[] }),
    );

  // GDELT is preferred but often slow: if it has not answered within HEDGE_MS (or fails sooner), Google News starts
  // alongside it and the first attempt with usable headlines wins.
  const gdelt = attempt("gdelt", () => fetchGdelt(plan.query, doFetch, now));
  let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
  const early = await Promise.race([gdelt, new Promise<null>((resolve) => (hedgeTimer = setTimeout(() => resolve(null), HEDGE_MS)))]);
  clearTimeout(hedgeTimer);
  if (early && early.items.length > 0) return done("gdelt", early.items);

  const google = attempt("google-news", () => fetchGoogleNews(plan.query, doFetch));
  const pending = new Map<string, Promise<{ source: "gdelt" | "google-news"; items: NewsItem[]; key: string }>>();
  if (!early) pending.set("gdelt", gdelt.then((r) => ({ ...r, key: "gdelt" })));
  pending.set("google-news", google.then((r) => ({ ...r, key: "google-news" })));
  while (pending.size > 0) {
    const r = await Promise.race(pending.values());
    if (r.items.length > 0) return done(r.source, r.items);
    pending.delete(r.key);
  }
  return done("none", []);
}
