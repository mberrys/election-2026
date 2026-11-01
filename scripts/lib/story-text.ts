/**
 * Pure text helpers for scripts/build-stories.ts: turn Wikipedia wikitext into short, cited
 * prose paragraphs and attribute them to candidates. No I/O here so it can be unit-tested.
 *
 * Principles: never invent text. Paragraphs are copied from the article (cleaned of markup) and
 * trimmed only at sentence boundaries. If a paragraph still contains a template we cannot render,
 * the whole paragraph is dropped instead of shipping a sentence with a hole in it.
 */
import { stripAccents } from "./util";
import { stripComments } from "./wikitext";

/** Marks the spot where an unrenderable inline template was removed; paragraphs containing it are dropped. */
const HOLE = "\u0001";

// ---------- citation markers / entities ----------

/** Remove citation markers such as [1], [12], [a], [note 3], [citation needed], [update]. */
export function stripCitationMarkers(s: string): string {
  return s
    .replace(/\[(?:\d{1,3}|[a-z]|note \d+|nb \d+|citation needed|clarification needed|update|when\?|who\?|dubious[^\]]*|better source needed)\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => (n.toLowerCase() === "amp" ? m : (NAMED_ENTITIES[n.toLowerCase()] ?? m)))
    .replace(/&amp;/g, "&");
}

// ---------- wikitext scanning ----------

/**
 * Remove comments, refs and blocks we cannot render. Runs until nothing changes, so a tag split around
 * another one ("<ref<ref/>>") cannot survive a single pass.
 */
function stripCommentsAndRefs(s: string): string {
  let out = stripComments(s);
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out
      .replace(/<ref\b[^>]*\/\s*>/gi, "")
      .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, "")
      .replace(/<(gallery|timeline|imagemap|noinclude|score)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "\n")
      // inline blocks we cannot reproduce: mark the paragraph so it is dropped rather than shipped with a hole
      .replace(/<(math|poem|blockquote|syntaxhighlight)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, HOLE)
      .replace(/<\/?(onlyinclude|includeonly)\s*>/gi, "");
  }
  return out;
}

/** Remove (possibly nested) `{| ... |}` tables. */
export function stripTables(s: string): string {
  const out: string[] = [];
  let depth = 0;
  for (const line of s.split("\n")) {
    const t = line.trimStart();
    if (t.startsWith("{|")) {
      depth++;
      continue;
    }
    if (depth > 0) {
      if (t.startsWith("|}") && !t.startsWith("|}}")) depth--;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

const SILENT_TEMPLATES = new RegExp(
  "^(" +
    [
      "cite[ _]?.*",
      "citation",
      "sfn",
      "sfnp",
      "harv",
      "efn",
      "efn-.*",
      "refn",
      "notetag",
      "cn",
      "citation needed",
      "fact",
      "clarify",
      "better source.*",
      "dead link",
      "failed verification",
      "verify source",
      "when",
      "who",
      "update.*",
      "as of",
      "main",
      "main article",
      "see also",
      "further",
      "about",
      "for",
      "for-multi",
      "distinguish",
      "redirect.*",
      "other uses.*",
      "short description",
      "use .*",
      "toc.*",
      "reflist",
      "notelist.*",
      "refbegin",
      "refend",
      "portal.*",
      "commons.*",
      "wikiquote.*",
      "wikisource.*",
      "clear",
      "-",
      "pp.*",
      "multiple image",
      "image.*",
      "location map.*",
      "legend.*",
      "infobox.*",
      "election box.*",
      "endorsements box",
      "us.* sidebar",
      ".* sidebar",
      "navbox.*",
      "authority control",
      "anchor",
      "div col.*",
      "div col end",
      "columns-list",
      "nowrap begin",
      "nowrap end",
    ].join("|") +
    ")$",
  "i",
);

function splitTopLevelPipes(s: string): string[] {
  const parts: string[] = [];
  let dT = 0;
  let dL = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "{{") {
      dT++;
      cur += two;
      i++;
    } else if (two === "}}") {
      dT = Math.max(0, dT - 1);
      cur += two;
      i++;
    } else if (two === "[[") {
      dL++;
      cur += two;
      i++;
    } else if (two === "]]") {
      dL = Math.max(0, dL - 1);
      cur += two;
      i++;
    } else if (s[i] === "|" && dT === 0 && dL === 0) {
      parts.push(cur);
      cur = "";
    } else cur += s[i];
  }
  parts.push(cur);
  return parts;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Render the inline templates whose text we can reproduce exactly. Returns undefined when unknown. */
function renderInlineTemplate(name: string, args: string[]): string | undefined {
  const pos = args.filter((a) => !/^\s*[a-z_ -]+\s*=/i.test(a)).map((a) => a.trim());
  switch (name) {
    case "nowrap":
    case "nobr":
    case "small":
    case "smaller":
    case "big":
    case "larger":
    case "nobold":
    case "noitalic":
    case "center":
    case "formatnum":
    case "tmath":
    case "em":
    case "strong":
    case "mono":
    case "sc":
    case "smallcaps":
    case "nobreak":
      return pos.join(" ");
    case "nbsp":
      return " ";
    case "ndash":
    case "spnd":
      return "–";
    case "snd":
    case "spaced ndash":
      return " – ";
    case "mdash":
      return "—";
    case "'":
      return "'";
    case "abbr":
      return pos[0] ?? "";
    case "lang":
    case "langx":
    case "transliteration":
    case "script":
      return pos[pos.length - 1] ?? "";
    case "convert": {
      const n = pos[0];
      const unit = pos[1];
      return n && unit && /^[a-z]/i.test(unit) ? `${n} ${unit}` : undefined;
    }
    case "us$":
    case "usd":
      return pos[0] ? `$${pos[0]}` : undefined;
    default:
      return undefined;
  }
}

function renderAsOf(args: string[]): string | undefined {
  const pos = args.filter((a) => !/=/.test(a)).map((a) => a.trim());
  const lc = args.some((a) => /^\s*lc\s*=\s*y/i.test(a));
  const [y, m, d] = pos;
  if (!/^\d{4}$/.test(y ?? "")) return undefined;
  const mi = Number(m);
  let tail = y;
  if (m && mi >= 1 && mi <= 12) tail = d && /^\d{1,2}$/.test(d) ? `${MONTHS[mi - 1]} ${Number(d)}, ${y}` : `${MONTHS[mi - 1]} ${y}`;
  return `${lc ? "as of" : "As of"} ${tail}`;
}

/** Replace templates: block-level ones vanish, known inline ones render, unknown inline ones leave a HOLE. */
export function resolveTemplates(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "{" && src[i + 1] === "{") {
      // find matching close
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        if (src[j] === "{" && src[j + 1] === "{") {
          depth++;
          j++;
        } else if (src[j] === "}" && src[j + 1] === "}") {
          depth--;
          j++;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) {
        // unbalanced: drop the rest of the line
        const nl = src.indexOf("\n", i);
        i = nl < 0 ? src.length : nl;
        continue;
      }
      const inner = src.slice(i + 2, j - 1);
      const end = j + 1;
      const lineStart = src.lastIndexOf("\n", i - 1) + 1;
      const nextNl = src.indexOf("\n", end);
      const lineEnd = nextNl < 0 ? src.length : nextNl;
      const block = src.slice(lineStart, i).trim() === "" && src.slice(end, lineEnd).trim() === "";
      const parts = splitTopLevelPipes(inner);
      const name = parts[0].trim().toLowerCase().replace(/[_\s]+/g, " ");
      const args = parts.slice(1);
      if (block) {
        out += "\n";
      } else if (name === "as of") {
        const r = renderAsOf(args);
        out += r ?? HOLE;
      } else if (SILENT_TEMPLATES.test(name)) {
        // citations, footnotes, hatnotes, layout metadata: removing them leaves the sentence intact
        out += "";
      } else {
        const r = renderInlineTemplate(name, args.map((a) => resolveTemplates(a)));
        out += r !== undefined ? r : HOLE;
      }
      i = end;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

/** Remove `[[File:...]]`, `[[Image:...]]`, `[[Category:...]]` links (their captions can nest other links). */
export function stripMediaLinks(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("[[", i) && /^\[\[\s*(file|image|media|category|:category)\s*:/i.test(s.slice(i, i + 16))) {
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        if (s.startsWith("[[", j)) {
          depth++;
          j++;
        } else if (s.startsWith("]]", j)) {
          depth--;
          j++;
          if (depth === 0) break;
        }
      }
      i = depth === 0 ? j + 1 : s.length;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

function linksAndMarkup(s: string): string {
  let t = stripMediaLinks(s);
  t = t.replace(/\[\[(?:[^\]|[]*\|)?([^\][]*)\]\]/g, "$1");
  t = t.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]*)\]/g, "$1").replace(/\[https?:\/\/[^\s\]]*\]/g, "");
  t = t.replace(/<br\s*\/?>/gi, " ");
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(/<[^>]+>/g, "");
  }
  t = t.replace(/'{2,}/g, "");
  return decodeEntities(t);
}

function tidy(p: string): string {
  return stripCitationMarkers(p.replace(/\s+/g, " ")).trim();
}

/**
 * Wikitext -> plain-text prose paragraphs. Tables, lists, indented lines, block templates, media and
 * paragraphs that still contain markup or an unrenderable template are dropped.
 */
export function proseParagraphs(wikitext: string, opts: { minLength?: number } = {}): string[] {
  const minLength = opts.minLength ?? 50;
  const stage = resolveTemplates(stripTables(stripCommentsAndRefs(wikitext)));
  const cleaned = linksAndMarkup(stage);
  const paras: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) paras.push(cur.join(" "));
    cur = [];
  };
  for (const raw of cleaned.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[*#;:]/.test(line) || /^\|/.test(line) || /^!/.test(line) || /^__\w+__$/.test(line) || /^-{4,}$/.test(line)) {
      flush();
      continue;
    }
    cur.push(line);
  }
  flush();
  const out: string[] = [];
  for (const p of paras) {
    if (p.includes(HOLE)) continue;
    const t = tidy(p);
    if (t.length < minLength) continue;
    if (/[{}|[\]]|==|<|>/.test(t)) continue;
    if (/:$/.test(t)) continue; // lead-in to a list we dropped
    if (/[a-z]:[A-Z]/.test(t)) continue; // a quote or list was removed mid-paragraph
    if (!/[.!?]["”')]*$/.test(t)) continue; // captions / fragments
    out.push(t);
  }
  return out;
}

// ---------- sections ----------

export interface WikiSection {
  level: number;
  title: string;
  /** Titles from the top-level ancestor down to this section. */
  path: string[];
  /** Own wikitext, up to the next heading of any level. */
  body: string;
}

function headingTitle(raw: string): string {
  return tidy(linksAndMarkup(resolveTemplates(raw)));
}

/** Split an article into its lead and ordered sections (every heading level, with ancestry). */
export function splitSections(wikitext: string): { lead: string; sections: WikiSection[] } {
  const text = stripCommentsAndRefs(wikitext);
  const lines = text.split("\n");
  const sections: WikiSection[] = [];
  const leadLines: string[] = [];
  let cur: { level: number; title: string; body: string[] } | undefined;
  const stack: Array<{ level: number; title: string }> = [];
  const flush = () => {
    if (!cur) return;
    sections.push({ level: cur.level, title: cur.title, path: stack.map((s) => s.title), body: cur.body.join("\n") });
    cur = undefined;
  };
  let tableDepth = 0;
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith("{|")) tableDepth++;
    const h = tableDepth === 0 ? /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line.trim()) : null;
    if (t.startsWith("|}") && !t.startsWith("|}}") && tableDepth > 0) tableDepth--;
    if (h) {
      flush();
      const level = h[1].length;
      const title = headingTitle(h[2]);
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title });
      cur = { level, title, body: [] };
      continue;
    }
    if (cur) cur.body.push(line);
    else leadLines.push(line);
  }
  flush();
  return { lead: leadLines.join("\n"), sections };
}

// ---------- sentence trimming ----------

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sen", "rep", "gov", "lt", "col", "gen", "sgt", "capt", "cmdr", "adm", "maj", "pres", "st", "mt", "ft", "jr", "sr",
  "no", "nos", "vs", "v", "inc", "co", "corp", "ltd", "rev", "hon", "del", "dist", "dept", "u.s", "u.k", "d.c", "a.m", "p.m", "e.g", "i.e", "etc", "approx", "est", "fig", "vol",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "ph.d", "ave", "blvd", "assn", "bros",
]);

/** Split prose into sentences without breaking on abbreviations, initials or decimals. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /([.!?]["”')\]]*)\s+(?=["“(\[]?[A-Z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const endIdx = m.index + m[1].length;
    const before = text.slice(start, m.index + 1);
    const lastTok = /(\S+)$/.exec(before)?.[1] ?? "";
    const bare = lastTok.replace(/^["“(\[]+/, "").replace(/[.!?]["”')\]]*$/, "");
    const isTerminalPunct = m[1][0] !== ".";
    if (!isTerminalPunct) {
      if (/^[A-Z]$/.test(bare)) continue; // initial: "J. D. Vance"
      if (ABBREVIATIONS.has(bare.toLowerCase())) continue;
      if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(bare)) continue; // "U.S", "D.C"
    }
    out.push(text.slice(start, endIdx).trim());
    start = endIdx;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * Trim to at most `max` characters at a sentence boundary. If even the first sentence is too long, cut at
 * the last clause break that fits and add an ellipsis (the words kept are still the source's own).
 */
export function trimToSentences(text: string, max = 600): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const sentences = splitSentences(t);
  let acc = "";
  for (const s of sentences) {
    const next = acc ? `${acc} ${s}` : s;
    if (next.length > max) break;
    acc = next;
  }
  if (acc) return acc;
  const head = t.slice(0, max);
  const cut = Math.max(head.lastIndexOf("; "), head.lastIndexOf(", "), head.lastIndexOf(" – "));
  if (cut > max * 0.5) return `${head.slice(0, cut).trim()}…`;
  const sp = head.lastIndexOf(" ");
  return `${head.slice(0, sp > 0 ? sp : max).trim()}…`;
}

// ---------- candidates ----------

export interface NamedCandidate {
  id: string;
  name: string;
  party: string;
  incumbent?: boolean;
}

function normText(s: string): string {
  return stripAccents(s).toLowerCase();
}

/** Core name tokens: lowercase, no accents, suffixes/nicknames/initials removed. */
export function coreTokens(name: string): string[] {
  return normText(name)
    .replace(/["“”][^"“”]*["“”]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,']/g, "")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !["jr", "sr", "ii", "iii", "iv", "mr", "mrs", "ms", "dr", "rev", "hon"].includes(t));
}

const COMMON_WORD_SURNAMES = new Set([
  "green", "brown", "love", "hill", "sand", "young", "white", "black", "hull", "king", "may", "bush", "cook", "wood", "ward", "rich", "mark", "hunt", "bell", "hall", "long", "wells", "price", "page", "case", "bond", "fox", "lane", "reed", "rose",
]);

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `text` refers to `cand`. `others` are the other candidates in the race (to disambiguate shared surnames). */
export function mentionsCandidate(text: string, cand: { name: string }, others: Array<{ name: string }> = []): boolean {
  const toks = coreTokens(cand.name);
  if (toks.length === 0) return false;
  const last = toks[toks.length - 1];
  const first = toks[0];
  const hay = normText(text);
  const shared = others.some((o) => o.name !== cand.name && coreTokens(o.name).slice(-1)[0] === last);
  const full = new RegExp(`\\b${esc(first)}\\b[^.!?]{0,30}\\b${esc(last)}\\b`);
  if (toks.length === 1) return new RegExp(`\\b${esc(last)}\\b`).test(hay);
  if (shared || COMMON_WORD_SURNAMES.has(last)) return full.test(hay);
  return new RegExp(`\\b${esc(last)}\\b`).test(hay);
}

/** Number of times `cand` is named in `text` (same matching rules as mentionsCandidate). */
export function countMentions(text: string, cand: { name: string }, others: Array<{ name: string }> = []): number {
  const toks = coreTokens(cand.name);
  if (toks.length === 0) return 0;
  const last = toks[toks.length - 1];
  const first = toks[0];
  const hay = normText(text);
  const shared = others.some((o) => o.name !== cand.name && coreTokens(o.name).slice(-1)[0] === last);
  const strict = toks.length > 1 && (shared || COMMON_WORD_SURNAMES.has(last));
  const re = strict ? new RegExp(`\\b${esc(first)}\\b[^.!?]{0,30}\\b${esc(last)}\\b`, "g") : new RegExp(`\\b${esc(last)}\\b`, "g");
  return (hay.match(re) ?? []).length;
}

/**
 * True when a paragraph is about `cand` rather than merely naming them: named at least twice, or once within its
 * first 100 characters. This keeps a rival's primary story from being filed under the nominee who is mentioned once in passing.
 */
export function isAboutCandidate(paragraph: string, cand: { name: string }, others: Array<{ name: string }> = []): boolean {
  if (countMentions(paragraph, cand, others) >= 2) return true;
  // a single mention counts only if it opens the paragraph (the candidate is its subject, not a passing reference)
  return countMentions(paragraph.slice(0, 100), cand, others) > 0;
}

/** Loose name equality for matching an article's nominee to a race's candidate: same surname and compatible first name. */
export function sameName(a: string, b: string): boolean {
  const ta = coreTokens(a);
  const tb = coreTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  const fa = ta[0];
  const fb = tb[0];
  return fa === fb || (fa.length >= 3 && fb.length >= 3 && (fa.startsWith(fb.slice(0, 3)) || fb.startsWith(fa.slice(0, 3))));
}

/** Names listed as nominees/candidates in the article's election infobox, with their party label. */
export function infoboxNominees(wikitext: string): Array<{ name: string; party: string }> {
  const m = /\{\{\s*Infobox election\b/i.exec(wikitext);
  if (!m) return [];
  const chunk = wikitext.slice(m.index, m.index + 6000);
  const get = (key: string) => {
    const r = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n]*)`, "i").exec(chunk);
    return r ? tidy(linksAndMarkup(resolveTemplates(r[1]))) : "";
  };
  const out: Array<{ name: string; party: string }> = [];
  for (let i = 1; i <= 6; i++) {
    const name = get(`(?:nominee|candidate)${i}`);
    if (name) out.push({ name, party: get(`party${i}`) });
  }
  return out;
}

export interface NomineePickInput {
  candidates: NamedCandidate[];
  party: "D" | "R";
  receipts?: Record<string, number>;
  /** Names from the article's infobox. */
  infobox?: Array<{ name: string; party: string }>;
}

/**
 * Choose the main candidate of a party, or none when it is a judgment call. Order: the article's infobox
 * nominee(s), then a sole incumbent, then a fundraiser with at least 3x the next (clear front-runner).
 */
export function pickNominee(input: NomineePickInput): NamedCandidate | undefined {
  const pool = input.candidates.filter((c) => c.party === input.party);
  if (pool.length <= 1) return pool[0];
  const infoNames = (input.infobox ?? []).map((n) => n.name);
  const listed = pool.filter((c) => infoNames.some((n) => sameName(n, c.name)));
  if (listed.length === 1) return listed[0];
  const narrowed = listed.length > 1 ? listed : pool;
  const incumbents = narrowed.filter((c) => c.incumbent);
  if (incumbents.length === 1) return incumbents[0];
  const money = narrowed
    .map((c) => ({ c, v: input.receipts?.[c.id] ?? 0 }))
    .sort((a, b) => b.v - a.v);
  if (money[0].v > 0 && money[0].v >= 3 * (money[1]?.v ?? 0)) return money[0].c;
  return undefined;
}

// ---------- sections: eligibility and classification ----------

const EXCLUDED_SECTION = /^(endorsements?|post-primary endorsements?|polling|polls?|opinion polls?|statewide .*polls?|fundraising|campaign finance|predictions?|ratings?|notes?|references?|external links|see also|further reading|exit polls?|results by .*|ballot language|ballot text|full text|text of .*|sources?|footnotes)$/i;

/** True if no ancestor/own heading marks the section as endorsements, polling, finance, notes etc. */
export function isProseSection(sec: WikiSection): boolean {
  return ![...sec.path].some((t) => EXCLUDED_SECTION.test(t.trim()));
}

export type Side = "yes" | "no";

const YES_RE = /^(support|supporters?|arguments? (?:in )?(?:favou?r|for|support)|in favou?r|proponents?|campaign for|yes campaign|case for|for)\b/i;
const NO_RE = /^(oppos(?:ition|ing|ers?)|opponents?|arguments? against|against|campaign against|no campaign|case against)\b/i;

/** Which side of a ballot measure a section speaks for, using its deepest matching heading. */
export function sideOfSection(sec: WikiSection): Side | undefined {
  for (let i = sec.path.length - 1; i >= 0; i--) {
    const t = sec.path[i].trim();
    if (YES_RE.test(t)) return "yes";
    if (NO_RE.test(t)) return "no";
  }
  return undefined;
}

// ---------- dates ----------

const MONTH_RE = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const DATE_RE = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,\\s*(\\d{4}))?\\b`, "g");

function monthIndex(m: string): number {
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m.slice(0, 3).toLowerCase());
}

export interface KeyDate {
  date: string;
  text: string;
}

/**
 * Dated events from prose: sentences that contain exactly one distinct month-day date. The date is
 * ISO when the year is explicit or `defaultYear` applies; the text is the source sentence, untouched.
 */
export function datedSentences(paragraphs: string[], defaultYear = 2026, maxLen = 320): KeyDate[] {
  const out: KeyDate[] = [];
  const seen = new Set<string>();
  for (const p of paragraphs) {
    for (const s of splitSentences(p)) {
      if (s.length > maxLen) continue;
      const found = new Map<string, { m: number; d: number; y: number }>();
      let m: RegExpExecArray | null;
      const re = new RegExp(DATE_RE.source, "g");
      while ((m = re.exec(s)) !== null) {
        const mi = monthIndex(m[1]);
        const d = Number(m[2]);
        if (mi < 0 || d < 1 || d > 31) continue;
        const y = m[3] ? Number(m[3]) : defaultYear;
        found.set(`${y}-${mi}-${d}`, { m: mi, d, y });
      }
      if (found.size !== 1) continue;
      if (!/\b(primary|runoff|run-off|debate|convention|caucus|elections?|nominat\w*|filing|deadline|ballot|early voting)\b/i.test(s)) continue;
      const { m: mi, d, y } = [...found.values()][0];
      const iso = `${y}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ date: iso, text: s });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- ballot measure notes ----------

/** Strip the trailing "(Source: ...)" from a races.json note and return the summary plus the cited source label. */
export function splitMeasureNote(notes: string): { summary: string; source?: string } {
  const m = /^([\s\S]*?)\s*\(Source:\s*([^)]*)\)\s*$/.exec(notes.trim());
  if (!m) return { summary: notes.trim() };
  return { summary: m[1].trim(), source: m[2].trim() };
}

// ---------- race <-> article matching ----------

/** "District 7" / "7th district" / "At-large" -> "07" / "AL". */
export function districtOfSection(title: string): string | undefined {
  const t = title.trim();
  const m = /^(?:district\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)?\s+(?:congressional\s+)?district)\b/i.exec(t);
  if (m) return String(Number(m[1] ?? m[2])).padStart(2, "0");
  if (/^(?:at[- ]large|district\s+at[- ]large|at-large district)\b/i.test(t)) return "AL";
  return undefined;
}

const MEASURE_ID_RE = /\b(Proposition|Propostion|Prop\.?|Amendment|Measure|Question|Issue|Proposal|Initiative|Referendum)\s+(?:No\.\s*)?(\d+[A-Za-z]?|[A-Z]{1,3})\b/g;

function normType(t: string): string {
  const x = t.toLowerCase().replace(/\.$/, "");
  return x === "prop" || x === "propostion" ? "proposition" : x;
}

/** ["proposition:40", "amendment:82"] found in a measure name or article title. */
export function measureIds(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(MEASURE_ID_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(`${normType(m[1])}:${m[2].toUpperCase()}`);
  return out;
}
