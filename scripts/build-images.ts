/**
 * Build the credited-image index for race pages: a portrait of each main candidate and a photo of each
 * state capitol, taken from Wikipedia lead images that live on Wikimedia Commons under a free licence.
 *
 *   npx tsx scripts/build-images.ts [--only=candidates,states] [--limit=N] [--no-cache] [--verbose]
 *
 * Output: public/data/reference/images.json  { builtAt, candidates: { [candidateId]: Img }, states: { [abbr]: Img } }
 *
 * Rules (see scripts/lib/image-meta.ts): an article is accepted only when its title names the candidate
 * and its lead mentions the candidate's state; the file must be on Commons, be public domain / CC0 /
 * CC BY / CC BY-SA, carry no watermark, and be at least 300 px wide. Anything else is skipped: a missing
 * picture beats the wrong person's. HTTP goes through scripts/lib/http.ts (cache in scripts/.cache/http,
 * descriptive User-Agent, 429/5xx backoff), strictly one request at a time.
 */
import fs from "node:fs";
import path from "node:path";
import type { CandidateMeta, RaceMeta } from "../src/data/schema";
import { fetchJson, setNoCache } from "./lib/http";
import {
  commonsTitle,
  isCommonsOriginal,
  isConfidentArticle,
  toImageEntry,
  type CommonsInfo,
  type ImageEntry,
  type RejectReason,
} from "./lib/image-meta";
import { STATES } from "./lib/states";
import { OUT_DIR, info, sleep, warn } from "./lib/util";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const SPACING_MS = 250;
const COMMONS_BATCH = 20;
const PORTRAIT_THUMB = 500; // Wikimedia serves thumbnails only at standard widths (…, 330, 500, 960, …); 480 is rounded to 500
const STATE_THUMB = 960;
const STATE_MIN_WIDTH = 800;
const STATE_MIN_ASPECT = 1.2;
const STATE_MAX_ASPECT = 2.8; // wider than this and a 16:7 crop would cut the building

// ---------- args ----------

function parseArgs(argv: string[]): { only: Set<string>; limit: number; noCache: boolean; verbose: boolean } {
  const only = new Set<string>();
  let limit = Infinity;
  let noCache = false;
  let verbose = false;
  for (const a of argv) {
    if (a === "--no-cache") noCache = true;
    else if (a === "--verbose") verbose = true;
    else if (a.startsWith("--only=")) a.slice(7).split(",").forEach((k) => only.add(k.trim()));
    else if (a.startsWith("--limit=")) limit = Number(a.slice(8)) || Infinity;
    else if (a === "--help" || a === "-h") {
      process.stdout.write("usage: tsx scripts/build-images.ts [--only=candidates,states] [--limit=N] [--no-cache] [--verbose]\n");
      process.exit(0);
    }
  }
  return { only, limit, noCache, verbose };
}

// ---------- candidates ----------

type Party = CandidateMeta["party"];
const partyOrder = (p: Party) => (p === "D" ? 0 : p === "R" ? 1 : 2);

/** Same selection as `mainCandidates` in src/components/race/race-view.tsx. */
function mainCandidates(meta: RaceMeta): CandidateMeta[] {
  const pickParty = (p: Party) => {
    const side = meta.candidates.filter((c) => c.party === p);
    return side.find((c) => c.incumbent) ?? side[0];
  };
  const main = [pickParty("D"), pickParty("R")].filter((c): c is CandidateMeta => !!c);
  if (main.length < 2) {
    const ind = meta.candidates.find((c) => !main.includes(c) && c.party !== "D" && c.party !== "R");
    if (ind) main.push(ind);
  }
  main.sort((a, b) => partyOrder(a.party) - partyOrder(b.party));
  return main;
}

interface Who {
  id: string;
  name: string;
  aliases: string[];
  party: Party;
  office: RaceMeta["office"];
  state: string;
  stateName: string;
}

const STATE_NAME = new Map(STATES.map((s) => [s.abbr, s.name]));

const OFFICE_WORDS: Partial<Record<RaceMeta["office"], string>> = {
  senate: "United States Senate",
  governor: "governor",
  house: "United States House of Representatives",
};

// ---------- MediaWiki ----------

interface WikiPageHit {
  title: string;
  index?: number;
  extract?: string;
  pageimage?: string;
  original?: { source: string; width: number; height: number };
  pageprops?: { disambiguation?: unknown };
}

interface WikiQuery {
  query?: { pages?: WikiPageHit[] };
}

const enc = encodeURIComponent;

async function searchArticles(query: string): Promise<WikiPageHit[]> {
  const url =
    `${WIKI_API}?action=query&format=json&formatversion=2&generator=search&gsrnamespace=0&gsrlimit=5` +
    `&gsrsearch=${enc(query)}&prop=extracts%7Cpageimages%7Cpageprops&exintro=1&explaintext=1&exlimit=max&exchars=500` +
    `&piprop=original%7Cname&pilimit=max&ppprop=disambiguation&redirects=1`;
  const { data } = await fetchJson<WikiQuery>(url, { minSpacingMs: SPACING_MS, label: `search:${query}` });
  const pages = data?.query?.pages ?? [];
  return pages.slice().sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
}

/** Clean a person name for a search string: no nickname quotes, parentheses or stray punctuation. */
function searchName(name: string): string {
  return name
    .replace(/["“”][^"“”]*["“”]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Match {
  article: string;
  file: string;
}

async function findPortraitFile(w: Who, verbose: boolean): Promise<{ match?: Match; why?: "no-article" | "no-lead-image" }> {
  const office = OFFICE_WORDS[w.office] ?? "";
  const names = [w.name, ...w.aliases.slice(0, 1)].map(searchName).filter(Boolean);
  const queries: string[] = [];
  for (const n of names) queries.push(`"${n}" ${w.stateName} ${office}`.trim());
  queries.push(`${names[0]} ${w.stateName} politician`);
  let sawArticle = false;
  for (const q of queries) {
    const hits = await searchArticles(q);
    for (const h of hits) {
      if (h.pageprops && "disambiguation" in h.pageprops) continue;
      if (!isConfidentArticle(h.title, h.extract ?? "", { name: w.name, aliases: w.aliases, party: w.party, stateName: w.stateName })) continue;
      sawArticle = true;
      if (!h.pageimage || !h.original || !isCommonsOriginal(h.original.source)) {
        if (verbose) info(`${w.id}: "${h.title}" has no Commons lead image`);
        return { why: "no-lead-image" };
      }
      return { match: { article: h.title, file: commonsTitle(h.pageimage) } };
    }
  }
  return { why: sawArticle ? "no-lead-image" : "no-article" };
}

// ---------- Commons ----------

interface CommonsPage extends Partial<Omit<CommonsInfo, "title">> {
  title: string;
  missing?: boolean;
  imageinfo?: Array<Omit<CommonsInfo, "title">>;
}

interface CommonsQuery {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: CommonsPage[];
  };
}

/** imageinfo for File: titles (batched). Keyed by the title as requested; absent when Commons has no such file. */
async function commonsInfo(files: string[], thumbWidth: number): Promise<Map<string, CommonsInfo>> {
  const out = new Map<string, CommonsInfo>();
  const uniq = [...new Set(files)];
  for (let i = 0; i < uniq.length; i += COMMONS_BATCH) {
    const batch = uniq.slice(i, i + COMMONS_BATCH);
    const url =
      `${COMMONS_API}?action=query&format=json&formatversion=2&redirects=1&prop=imageinfo` +
      `&iiprop=url%7Cextmetadata%7Csize%7Cmime&iiurlwidth=${thumbWidth}&titles=${enc(batch.join("|"))}`;
    const { data } = await fetchJson<CommonsQuery>(url, { minSpacingMs: SPACING_MS, label: `commons:${batch.length} files` });
    const q = data?.query;
    if (!q?.pages) continue;
    const byTitle = new Map(q.pages.map((p) => [p.title, p]));
    const hop = new Map<string, string>();
    for (const n of q.normalized ?? []) hop.set(n.from, n.to);
    for (const r of q.redirects ?? []) hop.set(r.from, r.to);
    for (const asked of batch) {
      let t = asked;
      for (let k = 0; k < 4 && hop.has(t); k++) t = hop.get(t)!;
      const p = byTitle.get(t);
      const ii = p?.imageinfo?.[0];
      if (!p || p.missing || !ii) continue;
      out.set(asked, { ...ii, title: p.title });
    }
  }
  return out;
}

// ---------- states ----------

/** Wikipedia article titles to try, in order, for each state's capitol. Default: "<State> State Capitol". */
const CAPITOL_TITLES: Record<string, string[]> = {
  DC: ["United States Capitol"],
  DE: ["Legislative Hall", "Delaware State Capitol"],
  IN: ["Indiana Statehouse"],
  ME: ["Maine State House"],
  MD: ["Maryland State House"],
  MA: ["Massachusetts State House"],
  NH: ["New Hampshire State House"],
  NJ: ["New Jersey State House"],
  OH: ["Ohio Statehouse"],
  RI: ["Rhode Island State House"],
  SC: ["South Carolina State House"],
  VT: ["Vermont State House"],
};

interface CapitolQuery {
  query?: {
    pages?: Array<{
      title: string;
      missing?: boolean;
      pageprops?: { disambiguation?: unknown };
      original?: { source: string };
      pageimage?: string;
    }>;
  };
}

/**
 * Hand-checked Commons exterior photos for states whose Wikipedia lead image is unusable (portrait,
 * panorama, scaffolding, interior) and where a name search only finds details or interiors. Each is still
 * run through the same licence, watermark and size rules; if one ever fails them it is simply skipped.
 */
const STATE_PICKS: Record<string, string[]> = {
  AZ: ["File:Arizona State Capitol Daytime December 2021.jpg"],
  FL: ["File:Florida’s Historic Capitol and Florida State Capitol 1.JPG"],
  KY: ["File:The south facade of the Kentucky State Capitol building located in Frankfort, Kentucky. Photographed by Tedd Liggett on September 15, 2018.jpg"],
  LA: ["File:Louisiana State Capitol 2.jpg"],
  MD: ["File:State House Annapolis Maryland.jpg"],
  PA: ["File:Pennsylvania State Capitol.jpg"],
  WA: ["File:Washington State Capitol (Olympia, Washington).jpg"],
};

/** A file name that plausibly shows the building's exterior: names the building, not an interior, detail, old print or sign. */
const NAME_OK = /capitol|state[ _-]?house|statehouse|legislative|building/i;
const NAME_BAD =
  /\bseal\b|\bflag\b|\bmap\b|\blogo\b|\bicon\b|coat[ _-]of|symbol|locator|diagram|\bplan\b|floor|interior|rotunda|chamber|senate|house[ _-]of|hall[ _-]of|inside|\bstatue\b|portrait|painting|drawing|postcard|historic|ceiling|stained|mural|monument|memorial|plaque|sculpture|fountain|commons-logo|question_book|wiktionary|edit-clear|oojs|crowd|protest|rally|\bfire\b|(?<!\d)1[789]\d\d(?!\d)|construction|cornerstone|night|pano|cemetery|route|highway|electrolier|\bdetail\b|\bsteps\b|\bold\b|former|dome[ _-]|views?[ _-]from|looking|\btree\b|library|stair|ironwork|\bcast\b|insurance|bldg|temple|chandelier|lobby|\boffice\b|\broom\b|statehood|gophers|\bsign\b[ _-]|support|protest|mining|demon/i;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

interface CommonsSearch {
  query?: { pages?: Array<{ title: string; index?: number }> };
}

/** Commons file search for exterior photos of a state capitol, best match first; names must name the state. */
async function searchCapitolFiles(stateName: string): Promise<string[]> {
  const q = `"${stateName} State Capitol" exterior filemime:image/jpeg`;
  const url =
    `${COMMONS_API}?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrlimit=30` +
    `&gsrsearch=${enc(q)}`;
  const { data } = await fetchJson<CommonsSearch>(url, { minSpacingMs: SPACING_MS, label: `capitol-files:${stateName}` });
  const pages = (data?.query?.pages ?? []).slice().sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  return pages
    .map((p) => p.title)
    .filter((f) => NAME_OK.test(f) && !NAME_BAD.test(f) && squash(f).includes(squash(stateName)))
    .slice(0, COMMONS_BATCH);
}

/**
 * The state's capitol photo: the Wikipedia article's own lead image when it is a landscape exterior
 * with a free licence, else the best Commons search hit that passes the same rules.
 */
async function stateImage(abbr: string, stateName: string, verbose: boolean): Promise<ImageEntry | undefined> {
  const opts = { minWidth: STATE_MIN_WIDTH, minAspect: STATE_MIN_ASPECT, maxAspect: STATE_MAX_ASPECT };
  const picks = STATE_PICKS[abbr] ?? [];
  if (picks.length) {
    const infos = await commonsInfo(picks, STATE_THUMB);
    for (const f of picks) {
      const r = toImageEntry(infos.get(f), opts);
      if (r.ok) {
        if (verbose) info(`${abbr}: -> ${f} (picked)`);
        return r.img;
      }
      warn(`${abbr}: picked file ${f} no longer passes (${r.ok ? "" : r.reason}); falling back`);
    }
  }
  const titles = CAPITOL_TITLES[abbr] ?? [`${stateName} State Capitol`];
  let leadTried: string | undefined;
  for (const t of titles) {
    const url =
      `${WIKI_API}?action=query&format=json&formatversion=2&redirects=1&titles=${enc(t)}` +
      `&prop=pageimages%7Cpageprops&piprop=original%7Cname&ppprop=disambiguation`;
    const { data } = await fetchJson<CapitolQuery>(url, { minSpacingMs: SPACING_MS, label: `capitol:${t}` });
    const page = data?.query?.pages?.[0];
    if (!page || page.missing || (page.pageprops && "disambiguation" in page.pageprops)) continue;
    if (!page.pageimage || !page.original || !isCommonsOriginal(page.original.source)) continue;
    const lead = commonsTitle(page.pageimage);
    leadTried = lead;
    if (!NAME_OK.test(lead) || NAME_BAD.test(lead)) {
      if (verbose) info(`${abbr}: lead ${lead} skipped by name`);
      continue;
    }
    const r = toImageEntry((await commonsInfo([lead], STATE_THUMB)).get(lead), opts);
    if (r.ok) {
      if (verbose) info(`${abbr}: ${page.title} -> ${lead} (lead image)`);
      return r.img;
    }
    if (verbose) info(`${abbr}: lead ${lead} rejected (${r.reason})`);
  }
  const files = (await searchCapitolFiles(stateName)).filter((f) => f !== leadTried);
  if (!files.length) return undefined;
  const infos = await commonsInfo(files, STATE_THUMB);
  for (const f of files) {
    const r = toImageEntry(infos.get(f), opts);
    if (r.ok) {
      if (verbose) info(`${abbr}: -> ${f} (Commons search)`);
      return r.img;
    }
    if (verbose) info(`${abbr}: ${f} rejected (${r.reason})`);
  }
  return undefined;
}

// ---------- output ----------

/** Pretty at the top level, one line per image, so the file stays small and diffs stay readable. */
function serialize(out: { builtAt: string; candidates: Record<string, ImageEntry>; states: Record<string, ImageEntry> }): string {
  const block = (m: Record<string, ImageEntry>) => {
    const keys = Object.keys(m).sort();
    if (!keys.length) return "{}";
    return "{\n" + keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(m[k])}`).join(",\n") + "\n }";
  };
  return `{\n "builtAt": ${JSON.stringify(out.builtAt)},\n "candidates": ${block(out.candidates)},\n "states": ${block(out.states)}\n}\n`;
}

function readExisting(file: string): { candidates: Record<string, ImageEntry>; states: Record<string, ImageEntry> } {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as { candidates?: Record<string, ImageEntry>; states?: Record<string, ImageEntry> };
    return { candidates: j.candidates ?? {}, states: j.states ?? {} };
  } catch {
    return { candidates: {}, states: {} };
  }
}

// ---------- main ----------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.noCache) setNoCache(true);
  const t0 = Date.now();
  const outFile = path.join(OUT_DIR, "images.json");
  const prev = readExisting(outFile);
  const doCandidates = args.only.size === 0 || args.only.has("candidates");
  const doStates = args.only.size === 0 || args.only.has("states");

  const races = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "races.json"), "utf8")) as RaceMeta[];
  const raceMains: Array<{ race: RaceMeta; main: CandidateMeta[] }> = races
    .filter((r) => r.office === "senate" || r.office === "governor" || r.office === "house")
    .map((race) => ({ race, main: mainCandidates(race) }));

  const who = new Map<string, Who>();
  for (const { race, main } of raceMains) {
    for (const c of main) {
      if (who.has(c.id)) continue;
      who.set(c.id, {
        id: c.id,
        name: c.name,
        aliases: c.aliases ?? [],
        party: c.party,
        office: race.office,
        state: race.state,
        stateName: STATE_NAME.get(race.state) ?? race.state,
      });
    }
  }

  let candidates: Record<string, ImageEntry> = doCandidates ? {} : prev.candidates;
  let states: Record<string, ImageEntry> = doStates ? {} : prev.states;
  const rejects: Record<string, number> = {};
  const bump = (k: string) => (rejects[k] = (rejects[k] ?? 0) + 1);

  if (doCandidates) {
    const list = [...who.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(0, args.limit);
    info(`finding articles for ${list.length} main candidates`);
    const found: Array<{ w: Who; m: Match }> = [];
    let n = 0;
    for (const w of list) {
      n++;
      if (n % 100 === 0) info(`  ${n}/${list.length}`);
      const r = await findPortraitFile(w, args.verbose);
      if (r.match) {
        found.push({ w, m: r.match });
        if (args.verbose) info(`${w.id} (${w.party} ${w.office} ${w.state}): ${r.match.article} -> ${r.match.file}`);
      } else {
        bump(r.why ?? "no-article");
        if (args.verbose) info(`${w.id} (${w.party} ${w.office} ${w.state}): ${r.why}`);
      }
    }
    info(`${found.length} confident articles with a Commons lead image; reading Commons metadata`);
    const infos = await commonsInfo(found.map((f) => f.m.file), PORTRAIT_THUMB);
    for (const { w, m } of found) {
      const r = toImageEntry(infos.get(m.file));
      if (r.ok) candidates[w.id] = r.img;
      else {
        const reason: RejectReason | "not-on-commons" = infos.has(m.file) ? r.reason : "not-on-commons";
        bump(`file:${reason}`);
        if (args.verbose) info(`${w.id}: ${m.file} (${m.article}) rejected: ${reason}`);
      }
    }
  }

  if (doStates) {
    info(`finding capitol photos for ${STATES.length} states`);
    for (const s of STATES) {
      const img = await stateImage(s.abbr, s.name, args.verbose);
      if (img) states[s.abbr] = img;
      else warn(`no usable capitol photo for ${s.abbr} (${s.name})`);
    }
  }

  // a partial run keeps whatever the other half holds on disk now (another run may have finished meanwhile)
  const now = readExisting(outFile);
  if (!doCandidates) candidates = now.candidates;
  if (!doStates) states = now.states;
  const builtAt = new Date().toISOString();
  const text = serialize({ builtAt, candidates, states });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outFile, text, "utf8");
  await sleep(0);

  // ---------- report ----------
  const total = who.size;
  const have = [...who.keys()].filter((id) => candidates[id]).length;
  const out = process.stdout;
  out.write(`\nimages.json: ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  out.write(`candidates with a portrait: ${have}/${total}\n`);
  out.write(`states with a capitol photo: ${Object.keys(states).length}/${STATES.length}\n`);
  out.write(`rejections: ${JSON.stringify(rejects)}\n`);
  for (const office of ["senate", "governor", "house"] as const) {
    const rs = raceMains.filter((r) => r.race.office === office);
    const withAny = rs.filter((r) => r.main.some((c) => candidates[c.id])).length;
    const withBoth = rs.filter((r) => r.main.length > 0 && r.main.every((c) => candidates[c.id])).length;
    out.write(`${office.padEnd(8)} races ${String(rs.length).padStart(3)} | >=1 portrait ${String(withAny).padStart(3)} | all main candidates ${String(withBoth).padStart(3)}\n`);
  }
  const none = raceMains.filter((r) => r.main.length > 0 && !r.main.some((c) => candidates[c.id]));
  const nonHouse = none.filter((r) => r.race.office !== "house");
  out.write(`races where no main candidate has a portrait: ${none.length} (${none.length - nonHouse.length} House)\n`);
  if (nonHouse.length) out.write(`  non-House: ${nonHouse.map((r) => r.race.id).join(", ")}\n`);
  const missingStates = STATES.filter((s) => !states[s.abbr]).map((s) => s.abbr);
  if (missingStates.length) out.write(`states without a photo: ${missingStates.join(", ")}\n`);
  const lic: Record<string, number> = {};
  for (const i of [...Object.values(candidates), ...Object.values(states)]) lic[i.license] = (lic[i.license] ?? 0) + 1;
  out.write(`licences: ${JSON.stringify(lic)}\n`);
}

main().catch((e) => {
  process.stderr.write(`build-images failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
