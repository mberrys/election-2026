import type { z } from "zod";
import { CandidateMeta, RaceMeta, raceId, type Party, type RatingCode } from "../../src/data/schema";
import { fetchText, fetchWikitext } from "./http";
import { consensusRating, parseRating, ratingLabel } from "./ratings";
import { STATE_BY_ABBR, STATES, stateAtStart, stateByName } from "./states";
import { candidateSlug, csvObjects, info, nameTokens, normName, ordinal, parseEnglishDate, slugify, warn } from "./util";
import {
  cellText,
  districtKey,
  extractCandidates,
  getSection,
  level2Sections,
  parseTables,
  partyFromCell,
  plainText,
  stripComments,
  stripRefs,
  type Cell,
  type ParsedCandidate,
  type Row,
} from "./wikitext";

export const WIKI_PAGES = {
  senate: "2026 United States Senate elections",
  house: "2026 United States House of Representatives elections",
  houseRatings: "2026 United States House of Representatives election ratings",
  governor: "2026 United States gubernatorial elections",
  ballot: "2026 United States ballot measures",
  stateleg: "2026 United States state legislative elections",
};
export const RIO_RATINGS_CSV = "https://www.riotimesonline.com/wp-content/uploads/rt-live/dataroom-us-ratings.csv";

type RaceMetaIn = z.input<typeof RaceMeta>;
type RaceMetaOut = z.output<typeof RaceMeta>;

export interface RacesResult {
  races: RaceMetaOut[];
  pages: Array<{ title: string; revid?: number }>;
  stats: Record<string, number>;
  rioTimes: { reachable: boolean; compared: number; disagreements: number; missingInRio: number };
}

// ---------- ratings tables ----------

interface RatingsRow {
  cook?: RatingCode;
  inside?: RatingCode;
  sabato?: RatingCode;
}
interface RatingsTable {
  rows: Map<string, RatingsRow>;
  dates: { cook?: string; inside?: string; sabato?: string };
}

function forecasterOf(c: Cell): "cook" | "inside" | "sabato" | undefined {
  const raw = c.raw;
  if (/partisan voting index/i.test(raw)) return undefined;
  if (/sabato/i.test(raw)) return "sabato";
  if (/inside elections|rothenberg|\|\s*IE\s*\]\]|^\s*IE\b/i.test(raw)) return "inside";
  if (/cook political|\[\[\s*(the )?cook political report|\|\s*cook\s*\]\]|^\s*'*\[*cook\b/i.test(raw)) return "cook";
  return undefined;
}

function parseRatingsTable(section: string, keyOf: (row: Row) => string | undefined, label: string): RatingsTable {
  const out: RatingsTable = { rows: new Map(), dates: {} };
  const tables = parseTables(section);
  const table = tables.find((t) => t.headerRows.some((r) => r.cells.some((c) => forecasterOf(c))));
  if (!table) {
    warn(`${label}: no ratings table found`);
    return out;
  }
  const header = table.headerRows.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  const cols: Array<{ idx: number; who: "cook" | "inside" | "sabato" }> = [];
  header.cells.forEach((c, idx) => {
    const who = forecasterOf(c);
    if (who && !cols.some((x) => x.who === who)) {
      cols.push({ idx, who });
      const d = parseEnglishDate(plainText(c.raw));
      if (d) out.dates[who] = d;
    }
  });
  if (cols.length === 0) {
    warn(`${label}: Cook/IE/Sabato columns not found in header`);
    return out;
  }
  const ratingCellCount = header.cells.filter((c) => /\{\{\s*usracerating|\bratings?\b/i.test(c.raw) || parseRating(cellText(c)) !== undefined).length;
  void ratingCellCount;
  for (const row of table.dataRows) {
    if (/sortbottom/.test(row.raw.split("\n")[0] ?? "")) continue;
    const key = keyOf(row);
    if (!key) continue;
    const r: RatingsRow = {};
    if (row.cells.length === header.cells.length) {
      for (const c of cols) r[c.who] = parseRating(row.cells[c.idx]?.raw);
    } else {
      // fallback: map rating-looking cells in order onto header rating columns
      const ratingHeaderIdx = header.cells
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => i >= 4 || forecasterOf(c))
        .map(({ i }) => i);
      const ratingCells = row.cells.filter((c) => /usracerating/i.test(c.raw) || parseRating(cellText(c)));
      if (ratingCells.length === ratingHeaderIdx.length) {
        for (const c of cols) {
          const pos = ratingHeaderIdx.indexOf(c.idx);
          if (pos >= 0) r[c.who] = parseRating(ratingCells[pos]?.raw);
        }
      } else {
        warn(`${label}: row "${key}" has ${row.cells.length} cells (header ${header.cells.length}); ratings skipped`);
        continue;
      }
    }
    out.rows.set(key, r);
  }
  return out;
}

function applyRatings(race: RaceMetaIn, rr: RatingsRow | undefined, dates: RatingsTable["dates"], source: string): void {
  if (!rr) return;
  const asOf = [dates.cook, dates.inside, dates.sabato].filter(Boolean).sort().reverse()[0];
  race.ratings = {
    cook: rr.cook,
    inside: rr.inside,
    sabato: rr.sabato,
    consensus: consensusRating([rr.cook, rr.inside, rr.sabato]),
    asOf,
    source,
  };
}

// ---------- candidates ----------

/**
 * Namesakes on one ballot (2026 AK Senate: incumbent Dan S. Sullivan and Dan J. Sullivan; DOJ has sued over
 * the confusion). Give each a middle-initial id and drop the shared "First Last" alias, so feed matching can only
 * succeed on the full name and votes are never credited to the wrong person.
 */
function disambiguateNamesakes(cands: Array<ReturnType<typeof CandidateMeta.parse>>): void {
  const key = (name: string) => {
    const t = nameTokens(name).filter((x) => x.replace(/\./g, "").length > 1);
    return `${t[0] ?? ""} ${t[t.length - 1] ?? ""}`;
  };
  const groups = new Map<string, typeof cands>();
  for (const c of cands) groups.set(key(c.name), [...(groups.get(key(c.name)) ?? []), c]);
  for (const [shared, group] of groups) {
    if (group.length < 2) continue;
    for (const c of group) {
      const initial = nameTokens(c.name).find((t) => t.replace(/\./g, "").length === 1)?.replace(/\./g, "");
      if (initial) c.id = `${candidateSlug(c.name)}-${initial.toLowerCase()}`;
      c.aliases = c.aliases.filter((a) => normName(a) !== normName(shared));
    }
  }
}

function uniqueSlugs(cands: Array<ReturnType<typeof CandidateMeta.parse>>): void {
  disambiguateNamesakes(cands);
  const seen = new Map<string, number>();
  for (const c of cands) {
    const n = seen.get(c.id) ?? 0;
    seen.set(c.id, n + 1);
    if (n > 0) c.id = `${c.id}-${n + 1}`;
  }
}

function toCandidates(parsed: ParsedCandidate[], incumbentName: string | undefined, heldBy: Party | undefined) {
  const kept = parsed.filter((c) => !c.flags.includes("withdrawn") && !(c.flags.includes("write-in") && c.party !== "D" && c.party !== "R"));
  const incNorm = incumbentName ? normName(incumbentName) : "";
  const incLoose = incumbentName ? nameTokens(incumbentName).filter((t) => t.length > 1).join(" ") : "";
  let incumbentIdx = -1;
  if (incNorm) {
    const exact = kept.map((c, i) => [normName(c.name), i] as const).filter(([n]) => n === incNorm);
    if (exact.length === 1) incumbentIdx = exact[0][1];
    else {
      const loose = kept
        .map((c, i) => ({ c, i, n: nameTokens(c.name).filter((t) => t.length > 1).join(" ") }))
        .filter((x) => x.n === incLoose);
      if (loose.length === 1) incumbentIdx = loose[0].i;
      else if (loose.length > 1) {
        const pref = loose.filter((x) => x.c.linked && (!heldBy || x.c.party === heldBy));
        incumbentIdx = (pref[0] ?? loose[0]).i;
      }
    }
  }
  const out = kept.map((c, i) => {
    const aliases = new Set<string>();
    const toks = nameTokens(c.name);
    if (toks.length >= 3) aliases.add(`${toks[0]} ${toks[toks.length - 1]}`.replace(/\b\w/g, (m) => m.toUpperCase()));
    return CandidateMeta.parse({
      id: candidateSlug(c.name),
      name: c.name,
      party: c.party,
      incumbent: i === incumbentIdx,
      aliases: Array.from(aliases),
    });
  });
  uniqueSlugs(out);
  return out;
}

function incumbentCell(row: Row): string | undefined {
  for (const c of row.cells) {
    const m = /\{\{\s*sortname\s*\|[^{}]*\}\}/i.exec(c.raw);
    if (m) return plainText(m[0]);
  }
  // fallback: a short linked name in cells 1-3 (drop "Redistricted from ..." suffixes)
  for (const c of row.cells.slice(1, 4)) {
    const raw = c.raw.trim();
    const link = /^\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/.exec(raw);
    if (link && link[1].length < 40 && !/\d/.test(link[1])) return link[1];
  }
  return undefined;
}

function partyOfRow(row: Row, skipLast = true): Party | undefined {
  const cells = skipLast ? row.cells.slice(0, -1) : row.cells;
  for (const c of cells) {
    const p = partyFromCell(c);
    if (p) return p;
    const m = /party shading\/(?:text\/)?(democratic|republican|independent|libertarian|green)/i.exec(c.raw);
    if (m) return partyFromCell({ attrs: `{{party shading/${m[1]}}}`, raw: "", header: false });
  }
  return undefined;
}

// ---------- builders ----------

function senateRaces(wikitext: string, pageTitle: string): RaceMetaIn[] {
  const out: RaceMetaIn[] = [];
  const specialSec = getSection(wikitext, /^Special elections during the preceding Congress$/i);
  const regularSec = getSection(wikitext, /^Elections leading to the next Congress$/i);
  const build = (row: Row, special: boolean) => {
    const label = cellText(row.cells[0]);
    const st = stateAtStart(label);
    if (!st) return;
    const heldBy = partyOfRow(row);
    const inc = incumbentCell(row);
    const parsed = extractCandidates(row.raw);
    const cands = toCandidates(parsed, inc, heldBy);
    const r: RaceMetaIn = {
      id: raceId("senate", st.abbr, undefined, special),
      office: "senate",
      state: st.abbr,
      special,
      name: `${st.name} Senate${special ? " (special)" : ""}`,
      candidates: cands,
      ratings: {},
      baseline: {},
      heldBy,
      runoffRule: st.abbr === "GA" ? "majority" : "none",
    };
    if (st.abbr === "LA") r.notes = "Louisiana now uses closed party primaries for Congress (Act 1 of 2024); Nov 3 general is plurality, no December runoff.";
    if (cands.length === 0) warn(`senate:${st.abbr}${special ? "-special" : ""}: no candidates parsed`);
    out.push(r);
  };
  if (specialSec) for (const t of parseTables(specialSec)) for (const row of t.dataRows) build(row, true);
  else warn("Senate page: specials section not found");
  if (regularSec) for (const t of parseTables(regularSec)) for (const row of t.dataRows) build(row, false);
  else warn("Senate page: regular race summary not found");

  const pred = getSection(wikitext, /^Predictions$/i);
  if (pred) {
    const rt = parseRatingsTable(pred, (row) => cellText(row.cells[0]), "Senate ratings");
    for (const r of out) {
      const st = STATE_BY_ABBR.get(r.state)!;
      const key = Array.from(rt.rows.keys()).find((k) => {
        const s = stateAtStart(k);
        return s?.abbr === st.abbr && /special/i.test(k) === !!r.special;
      });
      applyRatings(r, key ? rt.rows.get(key) : undefined, rt.dates, `Wikipedia: ${pageTitle} (Predictions)`);
      if (!key) warn(`${r.id}: no ratings row`);
    }
  } else warn("Senate page: Predictions section not found");
  return out;
}

function governorRaces(wikitext: string, pageTitle: string): RaceMetaIn[] {
  const out: RaceMetaIn[] = [];
  const summary = getSection(wikitext, /^Race summary$/i) ?? wikitext;
  const sec = getSection(summary, /^States$/i) ?? summary;
  for (const t of parseTables(sec)) {
    for (const row of t.dataRows) {
      const st = stateAtStart(cellText(row.cells[0]));
      if (!st) continue;
      const heldBy = partyOfRow(row);
      const inc = incumbentCell(row);
      const cands = toCandidates(extractCandidates(row.raw), inc, heldBy);
      if (cands.length === 0) warn(`governor:${st.abbr}: no candidates parsed`);
      out.push({
        id: raceId("governor", st.abbr),
        office: "governor",
        state: st.abbr,
        special: false,
        name: `${st.name} Governor`,
        candidates: cands,
        ratings: {},
        baseline: {},
        heldBy,
        runoffRule: st.abbr === "GA" ? "majority" : "none",
      });
    }
    if (out.length) break;
  }
  const pred = getSection(wikitext, /^Predictions$/i);
  if (pred) {
    const rt = parseRatingsTable(pred, (row) => cellText(row.cells[0]), "Governor ratings");
    for (const r of out) {
      const key = Array.from(rt.rows.keys()).find((k) => stateAtStart(k)?.abbr === r.state);
      applyRatings(r, key ? rt.rows.get(key) : undefined, rt.dates, `Wikipedia: ${pageTitle} (Predictions)`);
      if (!key) warn(`${r.id}: no ratings row`);
    }
  } else warn("Governor page: Predictions section not found");
  return out;
}

function houseRaces(wikitext: string): RaceMetaIn[] {
  const out: RaceMetaIn[] = [];
  const seen = new Set<string>();
  for (const sec of level2Sections(wikitext)) {
    const st = stateByName(sec.title);
    if (!st) continue;
    for (const t of parseTables(sec.body)) {
      for (const row of t.dataRows) {
        const k = districtKey(row.raw);
        if (!k || k.state !== st.abbr) continue;
        const id = raceId("house", k.state, k.district);
        if (seen.has(id)) continue;
        seen.add(id);
        const newSeat = /none\s*\{\{\s*small\s*\|\s*\(new (seat|district)\)/i.test(row.raw) || /colspan=3\s*\|\s*None/i.test(row.raw);
        const heldBy = newSeat ? undefined : partyOfRow(row);
        const inc = newSeat ? undefined : incumbentCell(row);
        const cands = toCandidates(extractCandidates(row.raw), inc, heldBy);
        const name = k.district === "AL" ? `${st.name} At-Large` : `${st.name} ${ordinal(Number(k.district))} District`;
        const r: RaceMetaIn = {
          id,
          office: "house",
          state: st.abbr,
          district: k.district,
          special: false,
          name,
          candidates: cands,
          ratings: {},
          baseline: {},
          heldBy,
          runoffRule: st.abbr === "GA" ? "majority" : "none",
        };
        if (newSeat) r.notes = "New seat (no incumbent).";
        out.push(r);
      }
    }
  }
  return out;
}

function houseRatings(wikitext: string, pageTitle: string, races: RaceMetaIn[]): void {
  const sec = getSection(wikitext, /latest published ratings/i) ?? getSection(wikitext, /^Election ratings$/i) ?? wikitext;
  const rt = parseRatingsTable(
    sec,
    (row) => {
      const k = districtKey(row.raw);
      return k ? `${k.state}-${k.district}` : undefined;
    },
    "House ratings",
  );
  const byKey = new Map(races.map((r) => [`${r.state}-${r.district}`, r]));
  let hit = 0;
  for (const [key, rr] of rt.rows) {
    const r = byKey.get(key);
    if (!r) {
      warn(`House ratings row ${key} has no matching race`);
      continue;
    }
    applyRatings(r, rr, rt.dates, `Wikipedia: ${pageTitle}`);
    hit++;
  }
  // seats absent from the competitive table are, by the page's definition, Safe/Solid for the holder
  for (const r of races) {
    if (r.ratings && (r.ratings as { consensus?: string }).consensus) continue;
    if (r.heldBy === "D" || r.heldBy === "R") {
      const code: RatingCode = r.heldBy === "D" ? "solid-d" : "solid-r";
      r.ratings = {
        consensus: code,
        asOf: [rt.dates.cook, rt.dates.inside, rt.dates.sabato].filter(Boolean).sort().reverse()[0],
        source: `Wikipedia: ${pageTitle} (not listed among competitive seats → solid for incumbent party)`,
      };
    }
  }
  info(`House ratings: ${hit} competitive rows applied`);
}

function measureSlug(title: string): string {
  const m = /\b(proposition|prop\.?|amendment|question|measure|issue|initiative|referendum|constitutional amendment|advisory question|act)\s*(?:no\.?\s*)?([A-Z]?\d+[A-Z]?|[IVX]+)\b/i.exec(title);
  if (m) {
    const kind = m[1].toLowerCase().startsWith("prop") ? "prop" : m[1].toLowerCase().replace(/\s+/g, "-");
    return `${kind}-${m[2].toLowerCase()}`;
  }
  const base = slugify(title.split(/[:,]/)[0]);
  return base.split("-").slice(0, 6).join("-");
}

function ballotRaces(wikitext: string, pageTitle: string): RaceMetaIn[] {
  const out: RaceMetaIn[] = [];
  const byState = getSection(wikitext, /^By state$/i) ?? wikitext;
  const chunks = byState.split(/^===\s*(.+?)\s*===\s*$/m);
  for (let i = 1; i < chunks.length; i += 2) {
    const st = stateByName(plainText(chunks[i]));
    const body = chunks[i + 1] ?? "";
    if (!st) continue;
    const used = new Set<string>();
    for (const t of parseTables(body)) {
      const header = t.headerRows[0]?.cells.map((c) => cellText(c).toLowerCase()) ?? [];
      const iMeasure = header.findIndex((h) => /measure|title|name/.test(h));
      const iDesc = header.findIndex((h) => /description|summary|subject/.test(h));
      const iDate = header.findIndex((h) => /date/.test(h));
      const iStatus = header.findIndex((h) => /status/.test(h));
      if (iMeasure < 0) continue;
      for (const row of t.dataRows) {
        const date = iDate >= 0 ? cellText(row.cells[iDate]) : "";
        const status = iStatus >= 0 ? cellText(row.cells[iStatus]) : "";
        const isNov3 = /^nov(ember)?\.?\s*3\b/i.test(date) || (/on ballot|certified|qualified/i.test(status) && /nov/i.test(date));
        if (!isNov3) continue;
        const title = cellText(row.cells[iMeasure]).replace(/\s+/g, " ").trim();
        if (!title) continue;
        let slug = measureSlug(title).replace(new RegExp(`^${slugify(st.name)}-`), "");
        let n = 2;
        while (used.has(slug)) slug = `${measureSlug(title)}-${n++}`;
        used.add(slug);
        const descRaw = iDesc >= 0 ? cellText(row.cells[iDesc]) : "";
        const desc = descRaw.length > 240 ? descRaw.slice(0, 237).replace(/\s+\S*$/, "") + "…" : descRaw;
        out.push({
          id: raceId("ballot", st.abbr, slug),
          office: "ballot",
          state: st.abbr,
          district: slug,
          special: false,
          name: title.length > 140 ? title.slice(0, 137) + "…" : title,
          candidates: [],
          ratings: {},
          baseline: {},
          runoffRule: "none",
          notes: desc ? `${desc} (Source: Wikipedia, ${pageTitle}; CC BY-SA 4.0)` : undefined,
        });
      }
    }
  }
  return out;
}

function chamberSlug(label: string): string | undefined {
  const l = label.toLowerCase();
  if (/senate/.test(l)) return "senate";
  if (/assembly/.test(l) && !/general assembly/.test(l)) return "assembly";
  if (/house/.test(l) || /delegates/.test(l)) return "house";
  if (/legislature|unicameral/.test(l)) return "legislature";
  return undefined;
}

function statelegRaces(wikitext: string, pageTitle: string): RaceMetaIn[] {
  const out: RaceMetaIn[] = [];
  const sec = getSection(wikitext, /^Electoral predictions$/i);
  if (!sec) {
    warn("State legislative page: Electoral predictions section not found");
    return out;
  }
  const tables = parseTables(sec);
  const table = tables.find((t) => t.headerRows.some((r) => r.cells.some((c) => /sabato/i.test(c.raw))));
  if (!table) {
    warn("State legislative page: predictions table not found");
    return out;
  }
  const header = table.headerRows.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  const sabDate = parseEnglishDate(plainText(header.cells.find((c) => /sabato/i.test(c.raw))?.raw ?? ""));
  let curState = stateAtStart("");
  for (const row of table.dataRows) {
    const first = cellText(row.cells[0]);
    const maybe = stateAtStart(first.replace(/^#/, ""));
    let ci: number;
    if (maybe && !chamberSlug(first)) {
      curState = maybe;
      ci = row.cells.findIndex((c, i) => i > 0 && chamberSlug(cellText(c)) !== undefined && /\[\[/.test(c.raw));
    } else {
      ci = row.cells.findIndex((c) => chamberSlug(cellText(c)) !== undefined && /\[\[/.test(c.raw));
    }
    if (!curState || ci < 0) continue;
    const chamberCell = row.cells[ci];
    const chamber = chamberSlug(cellText(chamberCell))!;
    const chamberName = plainText(chamberCell.raw);
    const heldBy = partyFromCell(chamberCell);
    const coalition = /coalition/i.test(chamberCell.attrs + chamberCell.raw);
    const sabCell = row.cells[ci + 2];
    const sabato = sabCell ? parseRating(sabCell.raw) : undefined;
    const lastText = cellText(row.cells[ci + 1]);
    const r: RaceMetaIn = {
      id: raceId("stateleg", curState.abbr, chamber),
      office: "stateleg",
      state: curState.abbr,
      district: chamber,
      special: false,
      name: `${curState.name} ${chamberName}`,
      candidates: [],
      ratings: sabato ? { sabato, consensus: sabato, asOf: sabDate, source: `Wikipedia: ${pageTitle} (Sabato's Crystal Ball)` } : {},
      baseline: {},
      heldBy,
      runoffRule: "none",
      notes: `Current composition: ${lastText}${coalition ? " (bipartisan coalition majority)" : ""}`,
    };
    out.push(r);
  }
  if (!out.some((r) => r.state === "NE")) {
    // Nebraska's unicameral is officially nonpartisan and omitted from the predictions table.
    out.push({
      id: raceId("stateleg", "NE", "legislature"),
      office: "stateleg",
      state: "NE",
      district: "legislature",
      special: false,
      name: "Nebraska Legislature",
      candidates: [],
      ratings: {},
      baseline: {},
      heldBy: "R",
      runoffRule: "none",
      notes: "Officially nonpartisan unicameral; Republican-endorsed majority (Wikipedia counts seats by endorsing party). 24 of 49 seats up. Embedded entry — not in the Wikipedia predictions table.",
    });
  }
  return out;
}

// ---------- Rio Times cross-check ----------

function rioLabelToId(chamber: string, race: string): string | undefined {
  if (/senate/i.test(chamber)) {
    const st = stateAtStart(race);
    if (!st) return undefined;
    return raceId("senate", st.abbr, undefined, /special/i.test(race));
  }
  if (/house/i.test(chamber)) {
    const m = /^([A-Z]{2})-(\d{1,2}|AL)$/.exec(race.trim());
    if (!m) return undefined;
    return raceId("house", m[1], m[2]);
  }
  if (/gov/i.test(chamber)) {
    const st = stateAtStart(race);
    return st ? raceId("governor", st.abbr) : undefined;
  }
  return undefined;
}

async function crossCheckRio(races: RaceMetaIn[]): Promise<RacesResult["rioTimes"]> {
  const res = await fetchText(RIO_RATINGS_CSV, { label: "riotimes-ratings" });
  const result = { reachable: res.ok, compared: 0, disagreements: 0, missingInRio: 0 };
  if (!res.ok) {
    warn(`Rio Times ratings CSV HTTP ${res.status}`);
    return result;
  }
  const rows = csvObjects(res.body);
  const byId = new Map(races.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (const row of rows) {
    const id = rioLabelToId(row.chamber ?? "", row.race ?? "");
    if (!id) continue;
    const r = byId.get(id);
    if (!r) continue;
    seen.add(id);
    const rio = parseRating(row.consensus);
    const ours = (r.ratings as { consensus?: RatingCode } | undefined)?.consensus;
    if (!rio) continue;
    result.compared++;
    if (ours !== rio) {
      result.disagreements++;
      const detail = `Rio Times consensus ${ratingLabel(rio)} (Cook ${row.cook}; IE ${row.inside_elections}; Sabato ${row.sabato}) vs ours ${ours ? ratingLabel(ours) : "none"}`;
      r.notes = r.notes ? `${r.notes} | ${detail}` : detail;
    }
  }
  for (const r of races) {
    const ours = (r.ratings as { consensus?: RatingCode } | undefined)?.consensus;
    if ((r.office === "senate" || r.office === "house") && ours && ours !== "solid-d" && ours !== "solid-r" && !seen.has(r.id)) {
      result.missingInRio++;
    }
  }
  info(`Rio Times cross-check: ${result.compared} compared, ${result.disagreements} disagreements`);
  return result;
}

// ---------- main ----------

export async function buildRaces(): Promise<RacesResult> {
  const pages: RacesResult["pages"] = [];
  const all: RaceMetaIn[] = [];
  const stats: Record<string, number> = {};

  const get = async (title: string) => {
    const p = await fetchWikitext(title);
    if (p) pages.push({ title: p.title, revid: p.revid });
    return p;
  };

  // Senate
  try {
    const p = await get(WIKI_PAGES.senate);
    if (p) {
      const rs = senateRaces(stripComments(p.wikitext), p.title);
      stats.senate = rs.length;
      all.push(...rs);
      info(`Senate: ${rs.length} races`);
    }
  } catch (e) {
    warn(`Senate build failed: ${(e as Error).stack ?? e}`);
  }
  // Governors
  try {
    const p = await get(WIKI_PAGES.governor);
    if (p) {
      const rs = governorRaces(stripComments(p.wikitext), p.title);
      stats.governor = rs.length;
      all.push(...rs);
      info(`Governors: ${rs.length} races`);
    }
  } catch (e) {
    warn(`Governor build failed: ${(e as Error).stack ?? e}`);
  }
  // House
  let house: RaceMetaIn[] = [];
  try {
    const p = await get(WIKI_PAGES.house);
    if (p) {
      house = houseRaces(stripComments(p.wikitext));
      stats.house = house.length;
      all.push(...house);
      info(`House: ${house.length} races`);
      if (house.length !== 435) warn(`House: expected 435 seats, parsed ${house.length}`);
    }
  } catch (e) {
    warn(`House build failed: ${(e as Error).stack ?? e}`);
  }
  try {
    const p = await get(WIKI_PAGES.houseRatings);
    if (p && house.length) houseRatings(stripRefs(stripComments(p.wikitext)), p.title, house);
  } catch (e) {
    warn(`House ratings failed: ${(e as Error).stack ?? e}`);
  }
  // Ballot measures
  try {
    const p = await get(WIKI_PAGES.ballot);
    if (p) {
      const rs = ballotRaces(stripComments(p.wikitext), p.title);
      stats.ballot = rs.length;
      all.push(...rs);
      info(`Ballot measures: ${rs.length}`);
    }
  } catch (e) {
    warn(`Ballot measures failed: ${(e as Error).stack ?? e}`);
  }
  // State legislatures
  try {
    const p = await get(WIKI_PAGES.stateleg);
    if (p) {
      const rs = statelegRaces(stripComments(p.wikitext), p.title);
      stats.stateleg = rs.length;
      all.push(...rs);
      info(`State legislative chambers: ${rs.length}`);
    }
  } catch (e) {
    warn(`State legislative failed: ${(e as Error).stack ?? e}`);
  }

  let rioTimes: RacesResult["rioTimes"] = { reachable: false, compared: 0, disagreements: 0, missingInRio: 0 };
  try {
    rioTimes = await crossCheckRio(all);
  } catch (e) {
    warn(`Rio Times cross-check failed: ${(e as Error).message}`);
  }

  // validate
  const races: RaceMetaOut[] = [];
  for (const r of all) {
    const v = RaceMeta.safeParse(r);
    if (v.success) races.push(v.data);
    else warn(`RaceMeta validation failed for ${r.id}: ${v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  stats.total = races.length;
  stats.candidates = races.reduce((a, r) => a + r.candidates.length, 0);
  stats.statesWithBallot = new Set(races.filter((r) => r.office === "ballot").map((r) => r.state)).size;
  void STATES;
  return { races, pages, stats, rioTimes };
}
