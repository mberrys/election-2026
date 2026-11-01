import fs from "node:fs";
import path from "node:path";
import { Baseline, type RaceMeta } from "../../src/data/schema";
import { fetchText, fetchWikitext } from "./http";
import { STATES, stateAtStart, stateByName } from "./states";
import { CACHE_DIR, csvObjects, ensureDir, info, parseCsv, round, warn } from "./util";
import { cellText, districtKey, extractCandidates, getSection, level2Sections, marginFromCandidates, parseTables, stripComments } from "./wikitext";

export const TONMCG_2024 =
  "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/master/2024_US_County_Level_Presidential_Results.csv";
export const TONMCG_2020 =
  "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/master/2020_US_County_Level_Presidential_Results.csv";
export const MEDSL_HOUSE_DOI = "doi:10.7910/DVN/IG0UN2";
export const MEDSL_DATASET_API = `https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=${MEDSL_HOUSE_DOI}`;
export const DOWNBALLOT_SHEET = "1eZfaFI-c-PFOoKx1-zZA2MP0_dxRq_LVK0re3BOQqy0";
export const DOWNBALLOT_GIDS = { percentages: "620838163", voteTotals: "1491069057", info: "1793797417" };

/** States flagged in the brief as having (possibly) new 2026 maps; Downballot coverage is reported per state. */
export const REDRAWN_2026 = ["TX", "CA", "MO", "UT", "NC", "OH", "FL", "TN", "LA", "AL"];

type BaselineT = ReturnType<typeof Baseline.parse>;

export interface CountyRow {
  margin2024?: number;
  margin2020?: number;
  turnout2024?: number;
  turnout2020?: number;
  state: string;
  name: string;
}

export interface BaselinesOut {
  builtAt: string;
  states: Record<string, { presMargin2024?: number; presMargin2020?: number; turnout2024?: number; turnout2020?: number }>;
  races: Record<string, BaselineT>;
  prior: {
    senate2020: Record<string, { margin: number; year: number }>;
    senate2022: Record<string, { margin: number; year: number }>;
    governor2022: Record<string, { margin: number; year: number }>;
    governor2024: Record<string, { margin: number; year: number }>;
    house2024Source: string;
    house2024: Record<string, { margin: number; year: number }>;
  };
  downballot: { fetched: boolean; districts: number; statesCovered: string[]; redrawnStatesCoverage: Record<string, { rows: number; has2020: number }> };
  medsl: { attempted: boolean; ok: boolean; message: string };
}

interface StateAgg {
  dem: number;
  gop: number;
  total: number;
}

function aggregateTonmcg(csv: string): { byState: Map<string, StateAgg>; byCounty: Map<string, { state: string; name: string; margin: number; total: number }> } {
  const rows = csvObjects(csv);
  const byState = new Map<string, StateAgg>();
  const byCounty = new Map<string, { state: string; name: string; margin: number; total: number }>();
  for (const r of rows) {
    const st = stateByName(r.state_name);
    if (!st) continue;
    const dem = Number(r.votes_dem);
    const gop = Number(r.votes_gop);
    const total = Number(r.total_votes);
    if (!Number.isFinite(total) || total <= 0) continue;
    const a = byState.get(st.abbr) ?? { dem: 0, gop: 0, total: 0 };
    a.dem += dem;
    a.gop += gop;
    a.total += total;
    byState.set(st.abbr, a);
    const fips = (r.county_fips ?? "").padStart(5, "0");
    if (fips) byCounty.set(fips, { state: st.abbr, name: r.county_name, margin: round(((dem - gop) / total) * 100, 2), total });
  }
  return { byState, byCounty };
}

export async function priorFromRaceSummary(page: string, sectionRe: RegExp, year: number, label: string, opts: { requireSection?: boolean } = {}) {
  const out: Record<string, { margin: number; year: number }> = {};
  const p = await fetchWikitext(page);
  if (!p) return out;
  const text = stripComments(p.wikitext);
  const found = getSection(text, sectionRe);
  // With `requireSection`, a page without that section yields nothing instead of falling back to the first table anywhere.
  if (!found && opts.requireSection) return out;
  const sec = found ?? text;
  for (const t of parseTables(sec)) {
    for (const row of t.dataRows) {
      const st = stateAtStart(cellText(row.cells[0]));
      if (!st) continue;
      const m = marginFromCandidates(extractCandidates(row.raw));
      if (m === undefined) continue;
      if (!(st.abbr in out)) out[st.abbr] = { margin: m, year };
    }
    if (Object.keys(out).length) break;
  }
  info(`${label}: ${Object.keys(out).length} prior margins`);
  return out;
}

const house2024FromWikipedia = () => houseFromWikipedia(2024);

export async function houseFromWikipedia(year: number): Promise<Record<string, { margin: number; year: number }>> {
  const out: Record<string, { margin: number; year: number }> = {};
  const p = await fetchWikitext(`${year} United States House of Representatives elections`);
  if (!p) return out;
  for (const sec of level2Sections(stripComments(p.wikitext))) {
    const st = stateByName(sec.title);
    if (!st) continue;
    for (const t of parseTables(sec.body)) {
      for (const row of t.dataRows) {
        const k = districtKey(row.raw);
        if (!k || k.state !== st.abbr) continue;
        const key = `${k.state}-${k.district}`;
        if (key in out) continue;
        const m = marginFromCandidates(extractCandidates(row.raw));
        if (m !== undefined) out[key] = { margin: m, year };
      }
    }
  }
  info(`House ${year} (Wikipedia): ${Object.keys(out).length} district margins`);
  return out;
}

async function house2024FromMedsl(): Promise<{ data: Record<string, { margin: number; year: number }>; status: BaselinesOut["medsl"] }> {
  const status: BaselinesOut["medsl"] = { attempted: true, ok: false, message: "" };
  const data: Record<string, { margin: number; year: number }> = {};
  const dir = path.join(CACHE_DIR, "medsl");
  ensureDir(dir);
  const local = path.join(dir, "1976-2024-house.tab");
  let text: string | undefined;
  if (fs.existsSync(local) && fs.statSync(local).size > 1_000_000) text = fs.readFileSync(local, "utf8");
  else {
    const meta = await fetchText(MEDSL_DATASET_API, { label: "medsl-meta", skipCache: true });
    if (!meta.ok) {
      status.message = `dataset metadata HTTP ${meta.status}`;
      return { data, status };
    }
    let fileId: number | undefined;
    try {
      const j = JSON.parse(meta.body) as { data: { latestVersion: { files: Array<{ dataFile: { id: number; filename: string } }> } } };
      fileId = j.data.latestVersion.files.find((f) => /house\.(tab|csv)$/i.test(f.dataFile.filename))?.dataFile.id;
    } catch {
      /* ignore */
    }
    if (!fileId) {
      status.message = "house data file id not found in dataset metadata";
      return { data, status };
    }
    const dl = await fetchText(`https://dataverse.harvard.edu/api/access/datafile/${fileId}`, { label: "medsl-house", skipCache: true });
    if (!dl.ok) {
      status.message = `datafile ${fileId} HTTP ${dl.status}: ${dl.body.slice(0, 160)}`;
      return { data, status };
    }
    fs.writeFileSync(local, dl.body, "utf8");
    text = dl.body;
  }
  const rows = text.split("\n");
  const header = rows[0].split("\t").map((h) => h.replace(/^"|"$/g, ""));
  const col = (n: string) => header.indexOf(n);
  const iYear = col("year"), iSt = col("state_po"), iDist = col("district"), iParty = col("party"), iVotes = col("candidatevotes"), iStage = col("stage"), iSpecial = col("special");
  if ([iYear, iSt, iDist, iParty, iVotes].some((i) => i < 0)) {
    status.message = `unexpected columns: ${header.slice(0, 12).join(",")}`;
    return { data, status };
  }
  const agg = new Map<string, { d: number; r: number; total: number }>();
  for (const line of rows.slice(1)) {
    const c = line.split("\t").map((x) => x.replace(/^"|"$/g, ""));
    if (c[iYear] !== "2024") continue;
    if (iStage >= 0 && c[iStage] && c[iStage].toUpperCase() !== "GEN") continue;
    if (iSpecial >= 0 && /true/i.test(c[iSpecial])) continue;
    const d = c[iDist] === "0" || c[iDist] === "00" ? "AL" : c[iDist].padStart(2, "0");
    const key = `${c[iSt]}-${d}`;
    const a = agg.get(key) ?? { d: 0, r: 0, total: 0 };
    const v = Number(c[iVotes]) || 0;
    const p = (c[iParty] ?? "").toUpperCase();
    if (p.startsWith("DEMOCRAT")) a.d += v;
    else if (p.startsWith("REPUBLICAN")) a.r += v;
    a.total += v;
    agg.set(key, a);
  }
  for (const [k, a] of agg) if (a.total > 0) data[k] = { margin: round(((a.d - a.r) / a.total) * 100, 1), year: 2024 };
  status.ok = Object.keys(data).length > 400;
  status.message = status.ok ? `parsed ${Object.keys(data).length} districts` : `only ${Object.keys(data).length} districts parsed`;
  return { data, status };
}

async function downballot(): Promise<{ map: Map<string, { m2024?: number; m2020?: number }>; info: BaselinesOut["downballot"] }> {
  const map = new Map<string, { m2024?: number; m2020?: number }>();
  const result: BaselinesOut["downballot"] = { fetched: false, districts: 0, statesCovered: [], redrawnStatesCoverage: {} };
  const urls = [
    `https://docs.google.com/spreadsheets/d/${DOWNBALLOT_SHEET}/export?format=csv&gid=${DOWNBALLOT_GIDS.percentages}`,
    `https://docs.google.com/spreadsheets/d/${DOWNBALLOT_SHEET}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${DOWNBALLOT_SHEET}/export?format=csv&gid=0`,
  ];
  let csv: string | undefined;
  for (const u of urls) {
    const r = await fetchText(u, { label: "downballot" });
    if (r.ok && /District/.test(r.body)) {
      csv = r.body;
      break;
    }
    warn(`Downballot export ${u.slice(-30)} → HTTP ${r.status}`);
  }
  if (!csv) return { map, info: result };
  result.fetched = true;
  const rows = parseCsv(csv);
  const hi = rows.findIndex((r) => r[0]?.trim() === "District");
  for (const r of rows.slice(hi + 1)) {
    const m = /^([A-Z]{2})-(\d{1,2}|AL)$/.exec((r[0] ?? "").trim());
    if (!m) continue;
    const key = `${m[1]}-${m[2] === "AL" ? "AL" : m[2].padStart(2, "0")}`;
    const h = Number(r[3]), t = Number(r[4]), b = Number(r[6]), t20 = Number(r[7]);
    const m2024 = Number.isFinite(h) && Number.isFinite(t) && r[3] !== "" ? round(h - t, 1) : undefined;
    const m2020 = Number.isFinite(b) && Number.isFinite(t20) && r[6] !== "" ? round(b - t20, 1) : undefined;
    map.set(key, { m2024, m2020 });
  }
  result.districts = map.size;
  result.statesCovered = Array.from(new Set(Array.from(map.keys()).map((k) => k.slice(0, 2)))).sort();
  for (const st of REDRAWN_2026) {
    const ks = Array.from(map.entries()).filter(([k]) => k.startsWith(st + "-"));
    result.redrawnStatesCoverage[st] = { rows: ks.length, has2020: ks.filter(([, v]) => v.m2020 !== undefined).length };
  }
  info(`Downballot: ${map.size} districts across ${result.statesCovered.length} states`);
  return { map, info: result };
}

export async function buildBaselines(races: RaceMeta[]): Promise<{ baselines: BaselinesOut; counties: Record<string, CountyRow> }> {
  const out: BaselinesOut = {
    builtAt: new Date().toISOString(),
    states: {},
    races: {},
    prior: { senate2020: {}, senate2022: {}, governor2022: {}, governor2024: {}, house2024Source: "", house2024: {} },
    downballot: { fetched: false, districts: 0, statesCovered: [], redrawnStatesCoverage: {} },
    medsl: { attempted: false, ok: false, message: "" },
  };
  const counties: Record<string, CountyRow> = {};

  // ---- presidential by state and county (tonmcg) ----
  try {
    const [r24, r20] = [await fetchText(TONMCG_2024, { label: "tonmcg-2024" }), await fetchText(TONMCG_2020, { label: "tonmcg-2020" })];
    const a24 = r24.ok ? aggregateTonmcg(r24.body) : undefined;
    const a20 = r20.ok ? aggregateTonmcg(r20.body) : undefined;
    if (!a24) warn(`tonmcg 2024 HTTP ${r24.status}`);
    if (!a20) warn(`tonmcg 2020 HTTP ${r20.status}`);
    for (const s of STATES) {
      const x = a24?.byState.get(s.abbr);
      const y = a20?.byState.get(s.abbr);
      out.states[s.abbr] = {
        presMargin2024: x ? round(((x.dem - x.gop) / x.total) * 100, 2) : undefined,
        presMargin2020: y ? round(((y.dem - y.gop) / y.total) * 100, 2) : undefined,
        turnout2024: x?.total,
        turnout2020: y?.total,
      };
    }
    const fipsSet = new Set([...(a24?.byCounty.keys() ?? []), ...(a20?.byCounty.keys() ?? [])]);
    for (const f of fipsSet) {
      const c24 = a24?.byCounty.get(f);
      const c20 = a20?.byCounty.get(f);
      counties[f] = {
        margin2024: c24?.margin,
        margin2020: c20?.margin,
        turnout2024: c24?.total,
        turnout2020: c20?.total,
        state: (c24 ?? c20)!.state,
        name: (c24 ?? c20)!.name,
      };
    }
    info(`Counties: ${Object.keys(counties).length} units (AK = state house districts, DC = wards, per tonmcg)`);
  } catch (e) {
    warn(`tonmcg baselines failed: ${(e as Error).message}`);
  }

  // ---- prior same-office races ----
  try {
    out.prior.senate2020 = await priorFromRaceSummary("2020 United States Senate elections", /^Elections leading to the next Congress$/i, 2020, "Senate 2020");
    out.prior.senate2022 = await priorFromRaceSummary("2022 United States Senate elections", /^Elections leading to the next Congress$/i, 2022, "Senate 2022");
    out.prior.governor2022 = await priorFromRaceSummary("2022 United States gubernatorial elections", /^States$/i, 2022, "Governor 2022");
    out.prior.governor2024 = await priorFromRaceSummary("2024 United States gubernatorial elections", /^States$/i, 2024, "Governor 2024");
  } catch (e) {
    warn(`prior race margins failed: ${(e as Error).message}`);
  }
  try {
    const medsl = await house2024FromMedsl();
    out.medsl = medsl.status;
    if (medsl.status.ok) {
      out.prior.house2024 = medsl.data;
      out.prior.house2024Source = `MEDSL U.S. House 1976–2024 (${MEDSL_HOUSE_DOI})`;
    } else {
      warn(`MEDSL House download unavailable (${medsl.status.message}); falling back to Wikipedia 2024 House page`);
      out.prior.house2024 = await house2024FromWikipedia();
      out.prior.house2024Source = "Wikipedia: 2024 United States House of Representatives elections (2024 lines)";
    }
  } catch (e) {
    warn(`House 2024 baseline failed: ${(e as Error).message}`);
  }

  // ---- Downballot presidential by 2026 CD ----
  let db = new Map<string, { m2024?: number; m2020?: number }>();
  try {
    const r = await downballot();
    db = r.map;
    out.downballot = r.info;
  } catch (e) {
    warn(`Downballot failed: ${(e as Error).message}`);
  }

  // ---- attach ----
  for (const race of races) {
    const st = out.states[race.state] ?? {};
    const b: Record<string, number | undefined> = {
      presMargin2024: st.presMargin2024,
      presMargin2020: st.presMargin2020,
      turnout2024: st.turnout2024,
    };
    if (race.office === "house") {
      const key = `${race.state}-${race.district}`;
      const d = db.get(key);
      b.presMargin2024 = d?.m2024;
      b.presMargin2020 = d?.m2020;
      b.turnout2024 = undefined;
      const prev = out.prior.house2024[key];
      if (prev) {
        b.prevRaceMargin = prev.margin;
        b.prevRaceYear = prev.year;
      }
      if (REDRAWN_2026.includes(race.state) && prev) {
        const n = "Prior House margin is the 2024 result on pre-2026 district lines.";
        race.notes = race.notes ? (race.notes.includes(n) ? race.notes : `${race.notes} | ${n}`) : n;
      }
      // New seats absent from the competitive-ratings table have no incumbent party to fall back on;
      // infer a solid rating from a lopsided presidential margin so the board can shade them.
      if (!race.ratings.consensus && d?.m2024 !== undefined && Math.abs(d.m2024) >= 10) {
        race.ratings = {
          consensus: d.m2024 > 0 ? "solid-d" : "solid-r",
          source: "Inferred: not in Wikipedia competitive-ratings table; 2024 presidential margin on 2026 lines (Downballot) exceeds 10 pts",
        };
      }
    } else if (race.office === "senate") {
      const prev = race.special ? out.prior.senate2022[race.state] : out.prior.senate2020[race.state];
      if (prev) {
        b.prevRaceMargin = prev.margin;
        b.prevRaceYear = prev.year;
      }
    } else if (race.office === "governor") {
      const prev = out.prior.governor2024[race.state] && (race.state === "NH" || race.state === "VT") ? out.prior.governor2024[race.state] : out.prior.governor2022[race.state];
      if (prev) {
        b.prevRaceMargin = prev.margin;
        b.prevRaceYear = prev.year;
      }
    }
    const parsed = Baseline.parse(Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)));
    race.baseline = parsed;
    out.races[race.id] = parsed;
  }
  return { baselines: out, counties };
}
