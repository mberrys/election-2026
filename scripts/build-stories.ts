/**
 * Build the "campaign story so far" text for race pages from Wikipedia (CC BY-SA 4.0).
 *
 *   npx tsx scripts/build-stories.ts [--only=senate,governor,house,ballot] [--no-cache] [--verbose]
 *
 * Output: public/data/reference/stories.json  { builtAt, license, races: { [raceId]: RaceStoryEntry } }
 *
 * Nothing here is written by us: overview and campaign paragraphs are copied from the cited article
 * (markup and citation markers removed, trimmed at sentence boundaries). A race with no confidently
 * matched text simply gets no entry. HTTP goes through scripts/lib/http.ts (cache in scripts/.cache/http,
 * 600 ms spacing, 429/5xx backoff, descriptive User-Agent), strictly one request at a time.
 */
import fs from "node:fs";
import path from "node:path";
import type { RaceMeta } from "../src/data/schema";
import type { RaceStory, StoriesFile, StoryCampaign } from "../src/data/reference/stories";
import { fetchJson, fetchWikitext, setNoCache, type WikiPage } from "./lib/http";
import { STATE_BY_ABBR } from "./lib/states";
import {
  datedSentences,
  districtOfSection,
  infoboxNominees,
  isAboutCandidate,
  isProseSection,
  measureIds,
  mentionsCandidate,
  pickNominee,
  proseParagraphs,
  sideOfSection,
  splitMeasureNote,
  splitSections,
  trimToSentences,
  type KeyDate,
  type NamedCandidate,
  type Side,
  type WikiSection,
} from "./lib/story-text";
import { OUT_DIR, info, warn, writeJson } from "./lib/util";

type StoryEntry = RaceStory;

const MAX_PARA = 600;
const MAX_OVERVIEW = 3;
const MAX_CAMPAIGN_PARAS = 3;
const MAX_KEY_DATES = 6;
const MAX_BYTES = 2_500_000;
const WIKI_API = "https://en.wikipedia.org/w/api.php";

// ---------- args ----------

type Kind = "senate" | "governor" | "house" | "ballot";

function parseArgs(argv: string[]): { only: Set<Kind>; noCache: boolean; verbose: boolean } {
  const only = new Set<Kind>();
  let noCache = false;
  let verbose = false;
  for (const a of argv) {
    if (a === "--no-cache") noCache = true;
    else if (a === "--verbose") verbose = true;
    else if (a.startsWith("--only=")) {
      for (const k of a.slice(7).split(",")) only.add(k.trim() as Kind);
    } else if (a === "--help" || a === "-h") {
      process.stdout.write("usage: tsx scripts/build-stories.ts [--only=senate,governor,house,ballot] [--no-cache] [--verbose]\n");
      process.exit(0);
    }
  }
  return { only, noCache, verbose };
}

// ---------- helpers ----------

function wikiUrl(title: string, anchor?: string): string {
  const base = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}`;
  return anchor ? `${base}#${encodeURIComponent(anchor.replace(/ /g, "_"))}` : base;
}

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(OUT_DIR, rel), "utf8")) as T;
}

interface ParsedArticle {
  page: WikiPage;
  lead: string;
  sections: WikiSection[];
}

const articleCache = new Map<string, ParsedArticle | null>();

async function loadArticle(titles: string[]): Promise<ParsedArticle | undefined> {
  for (const t of titles) {
    if (articleCache.has(t)) {
      const hit = articleCache.get(t);
      if (hit) return hit;
      continue;
    }
    const page = await fetchWikitext(t);
    if (!page) {
      articleCache.set(t, null);
      continue;
    }
    // a redirect to a general page (disambiguation, list) is not the article we want
    if (/\{\{\s*(disambiguation|disambig)\b/i.test(page.wikitext.slice(0, 4000))) {
      articleCache.set(t, null);
      continue;
    }
    const { lead, sections } = splitSections(page.wikitext);
    const parsed: ParsedArticle = { page, lead, sections };
    articleCache.set(t, parsed);
    return parsed;
  }
  return undefined;
}

interface Piece {
  sec: WikiSection;
  paras: string[];
}

function piecesOf(sections: WikiSection[]): Piece[] {
  return sections.filter(isProseSection).map((sec) => ({ sec, paras: proseParagraphs(sec.body) }));
}

function toNamed(c: RaceMeta["candidates"][number]): NamedCandidate {
  return { id: c.id, name: c.name, party: c.party, incumbent: c.incumbent };
}

function titleMentions(title: string, cand: { name: string }, all: NamedCandidate[]): boolean {
  return mentionsCandidate(title, cand, all);
}

const GENERAL_RE = /^(general election|campaign|campaigns|debates?|general election campaign)$/i;

function isGeneralSection(sec: WikiSection): boolean {
  return sec.path.some((t) => GENERAL_RE.test(t.trim()));
}

interface Nominees {
  d?: NamedCandidate;
  r?: NamedCandidate;
}

function nomineesFor(race: RaceMeta, wikitext: string | undefined): Nominees {
  const cands = race.candidates.map(toNamed);
  const receipts = race.money?.receipts;
  const infobox = wikitext ? infoboxNominees(wikitext) : [];
  return {
    d: pickNominee({ candidates: cands, party: "D", receipts, infobox }),
    r: pickNominee({ candidates: cands, party: "R", receipts, infobox }),
  };
}

/** Up to 3 paragraphs about one candidate: prose that names them (and not their general-election opponent). */
function campaignFor(
  cand: NamedCandidate,
  opponent: NamedCandidate | undefined,
  all: NamedCandidate[],
  pieces: Piece[],
  used: Set<string>,
): string[] {
  const picks: Array<{ order: number; prio: number; text: string }> = [];
  let order = 0;
  for (const piece of pieces) {
    const own = titleMentions(piece.sec.title, cand, all);
    for (const p of piece.paras) {
      order++;
      if (used.has(p)) continue;
      const text = trimToSentences(p, MAX_PARA);
      if (!own && !isAboutCandidate(text, cand, all)) continue;
      if (opponent && mentionsCandidate(p, opponent, all)) continue;
      picks.push({ order, prio: isGeneralSection(piece.sec) ? 0 : 1, text });
    }
  }
  const chosen = picks
    .sort((a, b) => a.prio - b.prio || a.order - b.order)
    .slice(0, MAX_CAMPAIGN_PARAS)
    .sort((a, b) => a.order - b.order);
  return chosen.map((c) => c.text);
}

function buildCampaigns(race: RaceMeta, nominees: Nominees, pieces: Piece[], used: Set<string>): StoryCampaign[] {
  const all = race.candidates.map(toNamed);
  const out: StoryCampaign[] = [];
  const pairs: Array<[NamedCandidate | undefined, NamedCandidate | undefined]> = [
    [nominees.d, nominees.r],
    [nominees.r, nominees.d],
  ];
  for (const [cand, opp] of pairs) {
    if (!cand) continue;
    const paragraphs = campaignFor(cand, opp, all, pieces, used);
    if (paragraphs.length) out.push({ candidateId: cand.id, name: cand.name, party: cand.party, paragraphs });
  }
  return out;
}

function overviewOf(paras: string[]): string[] {
  return paras.slice(0, MAX_OVERVIEW).map((p) => trimToSentences(p, MAX_PARA));
}

function keyDatesFrom(leadParas: string[], pieces: Piece[]): KeyDate[] | undefined {
  const debateParas = pieces.filter((p) => p.sec.path.some((t) => /debate/i.test(t))).flatMap((p) => p.paras);
  const dates = datedSentences([...leadParas, ...debateParas]).slice(0, MAX_KEY_DATES);
  return dates.length ? dates : undefined;
}

// ---------- Senate / governor ----------

function statewideTitles(race: RaceMeta, stateName: string): string[] {
  if (race.office === "governor") return [`2026 ${stateName} gubernatorial election`, `2026 ${stateName} gubernatorial and lieutenant gubernatorial election`];
  return race.special
    ? [`2026 United States Senate special election in ${stateName}`, `2026 United States Senate election in ${stateName}`]
    : [`2026 United States Senate election in ${stateName}`, `2026 United States Senate special election in ${stateName}`];
}

async function buildStatewide(race: RaceMeta): Promise<StoryEntry | undefined> {
  const state = STATE_BY_ABBR.get(race.state);
  if (!state) return undefined;
  const art = await loadArticle(statewideTitles(race, state.name));
  if (!art) return undefined;
  return buildFromWholeArticle(race, art);
}

/** The article is about exactly this race: lead = overview, every prose section is a candidate source. */
function buildFromWholeArticle(race: RaceMeta, art: ParsedArticle): StoryEntry | undefined {
  const leadParas = proseParagraphs(art.lead);
  const overview = overviewOf(leadParas);
  const pieces = piecesOf(art.sections);
  const used = new Set(leadParas);
  const campaigns = buildCampaigns(race, nomineesFor(race, art.page.wikitext), pieces, used);
  if (!overview.length && !campaigns.length) return undefined;
  const entry: StoryEntry = {
    source: { title: art.page.title, url: wikiUrl(art.page.title), revid: art.page.revid, kind: "wikipedia" },
    overview,
    campaigns,
  };
  const keyDates = keyDatesFrom(leadParas, pieces);
  if (keyDates) entry.keyDates = keyDates;
  return entry;
}

// ---------- House ----------

function houseTitles(stateName: string): string[] {
  return [
    `2026 United States House of Representatives elections in ${stateName}`,
    `2026 United States House of Representatives election in ${stateName}`,
  ];
}

async function loadHouseVariants(stateName: string): Promise<ParsedArticle[]> {
  const prefix = `2026 United States House of Representatives elections in ${stateName} (`;
  const url = `${WIKI_API}?action=query&list=allpages&apprefix=${encodeURIComponent(prefix)}&aplimit=50&apnamespace=0&format=json&formatversion=2`;
  const { data } = await fetchJson<{ query?: { allpages?: Array<{ title: string }> } }>(url, { minSpacingMs: 600, label: `wiki:allpages house ${stateName}` });
  const titles = (data?.query?.allpages ?? []).map((p) => p.title);
  const out: ParsedArticle[] = [];
  const seen = new Set<number>();
  for (const t of titles) {
    const a = await loadArticle([t]);
    if (a && !seen.has(a.page.pageid)) {
      seen.add(a.page.pageid); // hyphen and en-dash titles redirect to the same page
      out.push(a);
    }
  }
  return out;
}

async function buildHouse(race: RaceMeta, art: ParsedArticle): Promise<StoryEntry | undefined> {
  const want = race.district ?? "";
  const head = art.sections.find((s) => s.level === 2 && districtOfSection(s.title) === want);
  if (!head) {
    // single-district states: the state article is the district's article
    const hasDistrictSections = art.sections.some((s) => s.level === 2 && districtOfSection(s.title));
    if (want === "AL" && !hasDistrictSections && !/elections in/.test(art.page.title)) return buildFromWholeArticle(race, art);
    return undefined;
  }
  const subtree = art.sections.filter((s) => s.path[0] === head.title);
  const introParas = proseParagraphs(head.body);
  const overview = overviewOf(introParas);
  const pieces = piecesOf(subtree.filter((s) => s !== head));
  const used = new Set(introParas);
  // nominees: the district's own infobox is absent, so rely on incumbency/fundraising from races.json
  const campaigns = buildCampaigns(race, nomineesFor(race, undefined), pieces, used);
  if (!overview.length && !campaigns.length) return undefined;
  const entry: StoryEntry = {
    source: { title: art.page.title, url: wikiUrl(art.page.title, head.title), revid: art.page.revid, kind: "wikipedia" },
    overview,
    campaigns,
  };
  const keyDates = keyDatesFrom(introParas, pieces);
  if (keyDates) entry.keyDates = keyDates;
  return entry;
}

// ---------- ballot measures ----------

const MEASURE_TITLE_RE = /^2026 .+? (Proposition|Amendment|Measure|Question|Issue|Proposal|Initiative|Referendum)\b/;

const stateTitlesCache = new Map<string, string[]>();

async function measureTitlesForState(stateName: string): Promise<string[]> {
  const hit = stateTitlesCache.get(stateName);
  if (hit) return hit;
  const url = `${WIKI_API}?action=query&list=allpages&apprefix=${encodeURIComponent(`2026 ${stateName} `)}&aplimit=500&apnamespace=0&format=json&formatversion=2`;
  const { data } = await fetchJson<{ query?: { allpages?: Array<{ title: string }> } }>(url, { minSpacingMs: 600, label: `wiki:allpages ${stateName}` });
  const titles = (data?.query?.allpages ?? []).map((p) => p.title).filter((t) => MEASURE_TITLE_RE.test(t) && measureIds(t).length > 0);
  stateTitlesCache.set(stateName, titles);
  return titles;
}

const GENERIC_WORDS = new Set([
  "amendment", "proposition", "initiative", "measure", "constitution", "constitutional", "state", "states", "require", "requires", "required", "establish", "prohibit", "prohibits",
  "allow", "allows", "would", "which", "their", "other", "about", "ballot", "voters", "voter", "public", "provide", "provides", "change", "changes", "create", "creates", "authorize", "amend", "referendum",
  "question", "issue", "proposal", "bond", "legislature", "legislative", "government", "citizens", "people",
]);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length >= 5 && !GENERIC_WORDS.has(w))
      .map((w) => w.replace(/(ies|es|s)$/, "")),
  );
}

function sharedWords(a: string, b: string): number {
  const wa = contentWords(a);
  const wb = contentWords(b);
  let n = 0;
  for (const w of wa) if (wb.has(w)) n++;
  return n;
}

/** Heading names whose own prose is background for a measure article. */
const MEASURE_BACKGROUND_RE = /^(background|contents?|provisions?|summary|overview|ballot (?:language|summary)|description)$/i;

async function buildMeasure(race: RaceMeta, rejected: string[]): Promise<StoryEntry | undefined> {
  const state = STATE_BY_ABBR.get(race.state);
  const notes = race.notes ? splitMeasureNote(race.notes) : { summary: "" };
  const fallback = (): StoryEntry | undefined => {
    if (!notes.summary) return undefined;
    // the note says where it came from ("Wikipedia, 2026 United States ballot measures")
    const srcTitle = "2026 United States ballot measures";
    return {
      source: { title: srcTitle, url: wikiUrl(srcTitle), kind: "measure-summary" },
      overview: [trimToSentences(notes.summary, MAX_PARA)],
      campaigns: [],
    };
  };
  if (!state) return fallback();

  const titles = await measureTitlesForState(state.name);
  const nameIds = measureIds(race.name);
  const noteIds = measureIds(notes.summary);
  let title = titles.find((t) => measureIds(t).some((id) => nameIds.includes(id)));
  let viaNotes = false;
  if (!title && nameIds.length === 0) {
    title = titles.find((t) => measureIds(t).some((id) => noteIds.includes(id)));
    viaNotes = Boolean(title);
  }
  if (!title) return fallback();

  const art = await loadArticle([title]);
  if (!art) return fallback();

  const leadParas = proseParagraphs(art.lead);
  const pieces = piecesOf(art.sections);
  const articleText = [...leadParas, ...pieces.slice(0, 4).flatMap((p) => p.paras)].join(" ");
  const want = `${race.name} ${notes.summary}`;
  const overlap = sharedWords(want, articleText);
  if (overlap < (viaNotes ? 2 : 1)) {
    rejected.push(`${race.id} -> "${title}" (shared content words: ${overlap})`);
    return fallback();
  }

  let overviewParas = leadParas;
  if (overviewParas.join(" ").length < 250) {
    const extra = pieces.filter((p) => MEASURE_BACKGROUND_RE.test(p.sec.title.trim()) && p.sec.path.length === 1).flatMap((p) => p.paras);
    overviewParas = [...overviewParas, ...extra];
  }
  const overview = overviewOf(overviewParas);

  const campaigns: StoryCampaign[] = [];
  for (const side of ["yes", "no"] as Side[]) {
    const paras: string[] = [];
    let label = "";
    for (const piece of pieces) {
      if (sideOfSection(piece.sec) !== side) continue;
      if (!label) label = [...piece.sec.path].reverse().find((t) => sideOfSection({ ...piece.sec, path: [t] }) === side) ?? piece.sec.title;
      for (const p of piece.paras) if (paras.length < MAX_CAMPAIGN_PARAS && !overviewParas.includes(p)) paras.push(trimToSentences(p, MAX_PARA));
    }
    if (paras.length) campaigns.push({ name: label, side, paragraphs: paras });
  }
  // A "Campaign" section that is not split into support/opposition: keep it, unattributed to a side.
  const general: string[] = [];
  let generalLabel = "";
  for (const piece of pieces) {
    if (sideOfSection(piece.sec) || !piece.sec.path.some((t) => /^campaigns?$/i.test(t.trim()))) continue;
    if (!generalLabel) generalLabel = piece.sec.path.find((t) => /^campaigns?$/i.test(t.trim())) ?? "Campaign";
    for (const p of piece.paras) if (general.length < MAX_CAMPAIGN_PARAS && !overviewParas.includes(p)) general.push(trimToSentences(p, MAX_PARA));
  }
  if (general.length) campaigns.push({ name: generalLabel, paragraphs: general });

  if (!overview.length && !campaigns.length) return fallback();
  const entry: StoryEntry = {
    source: { title: art.page.title, url: wikiUrl(art.page.title), revid: art.page.revid, kind: "wikipedia" },
    overview,
    campaigns,
  };
  return entry;
}

// ---------- main ----------

interface PollsFile {
  races: Record<string, unknown>;
}

const COMPETITIVE = new Set(["tossup", "tilt-d", "tilt-r", "lean-d", "lean-r"]);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  setNoCache(args.noCache);
  const t0 = Date.now();

  const races = readJson<RaceMeta[]>("races.json");
  const polls = readJson<PollsFile>("polls.json");
  const polled = new Set(Object.keys(polls.races ?? {}));
  const want = (k: Kind) => args.only.size === 0 || args.only.has(k);

  const senate = races.filter((r) => r.office === "senate");
  const governor = races.filter((r) => r.office === "governor");
  const house = races.filter((r) => r.office === "house" && ((r.ratings.consensus && COMPETITIVE.has(r.ratings.consensus)) || polled.has(r.id)));
  const ballot = races.filter((r) => r.office === "ballot");

  const outPath = path.join(OUT_DIR, "stories.json");
  let prior: StoriesFile | undefined;
  if (args.only.size > 0 && fs.existsSync(outPath)) prior = JSON.parse(fs.readFileSync(outPath, "utf8")) as StoriesFile;
  const out: Record<string, StoryEntry> = { ...(prior?.races ?? {}) };
  const rejected: string[] = [];

  const plan: Array<{ kind: Kind; list: RaceMeta[] }> = [
    { kind: "senate", list: senate },
    { kind: "governor", list: governor },
    { kind: "house", list: house },
    { kind: "ballot", list: ballot },
  ];
  info(`targets: senate ${senate.length}, governor ${governor.length}, house ${house.length}, ballot ${ballot.length}`);

  for (const { kind, list } of plan) {
    if (!want(kind)) continue;
    for (const r of list) delete out[r.id];
    info(`-- ${kind} (${list.length})`);
    if (kind === "house") {
      const byState = new Map<string, RaceMeta[]>();
      for (const r of list) byState.set(r.state, [...(byState.get(r.state) ?? []), r]);
      for (const [st, rs] of byState) {
        const stateName = STATE_BY_ABBR.get(st)?.name;
        if (!stateName) continue;
        const main = await loadArticle(houseTitles(stateName));
        if (!main) {
          warn(`no House article for ${stateName}`);
          continue;
        }
        let variants: ParsedArticle[] | undefined;
        for (const r of rs) {
          let e = await buildHouse(r, main);
          if (!e && !main.sections.some((s) => s.level === 2 && districtOfSection(s.title))) {
            // big states split the districts across sub-articles ("... (districts 1-26)")
            variants ??= await loadHouseVariants(stateName);
            for (const v of variants) {
              e = await buildHouse(r, v);
              if (e) break;
            }
          }
          if (e) out[r.id] = e;
          else if (args.verbose) info(`  (none) ${r.id}`);
        }
      }
      continue;
    }
    for (const r of list) {
      const e = kind === "ballot" ? await buildMeasure(r, rejected) : await buildStatewide(r);
      if (e) out[r.id] = e;
      else if (args.verbose) info(`  (none) ${r.id}`);
    }
  }

  const sorted: Record<string, StoryEntry> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  const file: StoriesFile = { builtAt: new Date().toISOString(), license: "CC BY-SA 4.0", races: sorted };
  const json = JSON.stringify(file, null, 1) + "\n";
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_BYTES) warn(`stories.json is ${bytes} bytes, over the ${MAX_BYTES} budget`);
  writeJson(outPath, file);

  // ---------- coverage ----------
  const all = [...senate, ...governor, ...house, ...ballot];
  const stat = (kind: Kind, list: RaceMeta[]) => {
    const withEntry = list.filter((r) => out[r.id]);
    const withOverview = list.filter((r) => out[r.id]?.overview.length);
    const withCampaign = list.filter((r) => (out[r.id]?.campaigns.length ?? 0) > 0);
    const wiki = list.filter((r) => out[r.id]?.source.kind === "wikipedia");
    process.stdout.write(
      `${kind.padEnd(9)} races ${String(list.length).padStart(3)} | entry ${String(withEntry.length).padStart(3)} | overview ${String(withOverview.length).padStart(3)} | >=1 campaign ${String(withCampaign.length).padStart(3)} | wikipedia article ${String(wiki.length).padStart(3)}\n`,
    );
  };
  process.stdout.write(`\nstories.json: ${(bytes / 1024).toFixed(0)} KB, ${Object.keys(sorted).length} races, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  stat("senate", senate);
  stat("governor", governor);
  stat("house", house);
  stat("ballot", ballot);
  const twoSided = all.filter((r) => (out[r.id]?.campaigns.length ?? 0) >= 2).length;
  process.stdout.write(`races with both nominees' sections: ${twoSided}\n`);

  const competitive = all.filter((r) => r.office !== "ballot" && ((r.ratings.consensus && COMPETITIVE.has(r.ratings.consensus)) || polled.has(r.id)));
  const nothing = competitive.filter((r) => !out[r.id]);
  const noOverview = competitive.filter((r) => out[r.id] && out[r.id].overview.length === 0);
  const noCampaign = competitive.filter((r) => out[r.id] && out[r.id].campaigns.length === 0);
  process.stdout.write(`competitive/polled races: ${competitive.length}\n`);
  process.stdout.write(`  with nothing (${nothing.length}): ${nothing.map((r) => r.id).join(", ") || "-"}\n`);
  process.stdout.write(`  entry but no overview (${noOverview.length}): ${noOverview.map((r) => r.id).join(", ") || "-"}\n`);
  process.stdout.write(`  entry but no campaign section (${noCampaign.length}): ${noCampaign.map((r) => r.id).join(", ") || "-"}\n`);
  if (rejected.length) process.stdout.write(`rejected measure matches (fell back to summary):\n  ${rejected.join("\n  ")}\n`);
}

main().catch((e) => {
  process.stderr.write(`build-stories failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
