import { History, type RaceMeta } from "../../src/data/schema";
import { fetchText } from "./http";
import { houseFromWikipedia, priorFromRaceSummary, REDRAWN_2026 } from "./step-baselines";
import { csvObjects, info, round, warn } from "./util";

/** MEDSL "U.S. President 1976–2024" state returns: plain CSV, downloadable without the Dataverse guestbook. */
export const MEDSL_PRESIDENT_URL = "https://dataverse.harvard.edu/api/access/datafile/13887042";
export const MEDSL_PRESIDENT_DOI = "doi:10.7910/DVN/42MVDX";

/** States whose House map changed for the 2024 election, so 2022 district results do not line up with later years. */
export const REDRAWN_2024 = ["AL", "LA", "NY", "NC"];

const SENATE_FROM = 1990;
const GOVERNOR_FROM = 1990;
const LAST_PAST_YEAR = 2025;

type Series = Record<string, number>;
type HistoryT = ReturnType<typeof History.parse>;

export interface PresidentParse {
  years: number[];
  national: HistoryT["national"]["pres"];
  states: Record<string, Series>;
}

/** Aggregate MEDSL presidential rows into D-R margins by state and a national popular-vote line. */
export function parsePresidentCsv(csv: string): PresidentParse {
  const byKey = new Map<string, { d: number; r: number; total: number }>();
  for (const r of csvObjects(csv)) {
    if (!/^US PRESIDENT$/i.test(r.office ?? "")) continue;
    const year = r.year;
    const st = r.state_po;
    const total = Number(r.totalvotes);
    if (!year || !st || !Number.isFinite(total) || total <= 0) continue;
    const k = `${year}|${st}`;
    const a = byKey.get(k) ?? { d: 0, r: 0, total };
    const votes = Number(r.candidatevotes) || 0;
    const party = (r.party_simplified ?? "").toUpperCase();
    if (party === "DEMOCRAT") a.d += votes;
    else if (party === "REPUBLICAN") a.r += votes;
    a.total = Math.max(a.total, total);
    byKey.set(k, a);
  }

  const states: Record<string, Series> = {};
  const nat = new Map<string, { d: number; r: number; total: number }>();
  const years = new Set<number>();
  for (const [k, a] of byKey) {
    const [year, st] = k.split("|");
    (states[st] ??= {})[year] = round(((a.d - a.r) / a.total) * 100, 2);
    const n = nat.get(year) ?? { d: 0, r: 0, total: 0 };
    n.d += a.d;
    n.r += a.r;
    n.total += a.total;
    nat.set(year, n);
    years.add(Number(year));
  }
  const national: PresidentParse["national"] = {};
  for (const [year, n] of [...nat].sort(([a], [b]) => Number(a) - Number(b))) {
    national[year] = { d: round((n.d / n.total) * 100, 2), r: round((n.r / n.total) * 100, 2), margin: round(((n.d - n.r) / n.total) * 100, 2) };
  }
  return { years: [...years].sort((a, b) => a - b), national, states };
}

async function statewideHistory(
  kind: "senate" | "governor",
  years: number[],
  pageFor: (year: number) => string,
  sectionRe: RegExp,
): Promise<Record<string, Series>> {
  const out: Record<string, Series> = {};
  let covered = 0;
  for (const y of years) {
    const rows = await priorFromRaceSummary(pageFor(y), sectionRe, y, `${kind} ${y}`);
    const entries = Object.entries(rows).filter(([, v]) => Number.isFinite(v.margin) && Math.abs(v.margin) <= 100);
    if (!entries.length) continue;
    covered++;
    for (const [st, v] of entries) (out[st] ??= {})[String(y)] = v.margin;
  }
  info(`${kind} history: ${covered}/${years.length} election pages parsed, ${Object.keys(out).length} states`);
  return out;
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export async function buildHistory(races: RaceMeta[]): Promise<HistoryT | undefined> {
  const res = await fetchText(MEDSL_PRESIDENT_URL, { label: "medsl-president" });
  if (!res.ok) {
    warn(`MEDSL president 1976–2024 HTTP ${res.status}: ${res.body.slice(0, 160)}`);
    return undefined;
  }
  const pres = parsePresidentCsv(res.body);
  info(`President history: ${pres.years.length} elections (${pres.years[0]}–${pres.years[pres.years.length - 1]}), ${Object.keys(pres.states).length} states/DC`);

  const senate = await statewideHistory(
    "senate",
    range(SENATE_FROM + (SENATE_FROM % 2), 2024, 2),
    (y) => `${y} United States Senate elections`,
    /^Elections leading to the next Congress$/i,
  );
  const governor = await statewideHistory(
    "governor",
    range(GOVERNOR_FROM, LAST_PAST_YEAR, 1),
    (y) => `${y} United States gubernatorial elections`,
    /^States$/i,
  );

  const house: Record<number, Record<string, { margin: number; year: number }>> = {};
  for (const y of [2022, 2024]) house[y] = await houseFromWikipedia(y);

  const states: HistoryT["states"] = {};
  const abbrs = new Set([...Object.keys(pres.states), ...Object.keys(senate), ...Object.keys(governor)]);
  for (const st of [...abbrs].sort()) {
    states[st] = { pres: pres.states[st] ?? {}, senate: senate[st] ?? {}, governor: governor[st] ?? {} };
  }

  const districts: HistoryT["districts"] = {};
  for (const r of races) {
    if (r.office !== "house" || !r.district) continue;
    const key = `${r.state}-${r.district}`;
    const h: Series = {};
    for (const y of [2022, 2024]) {
      if (y === 2022 && REDRAWN_2024.includes(r.state)) continue;
      const v = house[y][key];
      if (v) h[String(y)] = v.margin;
    }
    const p: Series = {};
    if (r.baseline.presMargin2020 !== undefined) p["2020"] = r.baseline.presMargin2020;
    if (r.baseline.presMargin2024 !== undefined) p["2024"] = r.baseline.presMargin2024;
    districts[key] = {
      house: h,
      pres: p,
      ...(REDRAWN_2026.includes(r.state) ? { caveat: "redrawn-2026" as const } : REDRAWN_2024.includes(r.state) ? { caveat: "redrawn-2024" as const } : {}),
    };
  }

  return History.parse({ builtAt: new Date().toISOString(), years: pres.years, national: { pres: pres.national }, states, districts });
}
