import { Money, type RaceMeta } from "../../src/data/schema";
import { fetchJson } from "./http";
import { firstName, firstNamesMatch, info, lastName, nameTokens, normName, warn } from "./util";

export const FEC_BASE = "https://api.open.fec.gov/v1";

interface FecTotalsRow {
  candidate_id: string;
  name: string;
  party: string | null;
  state: string;
  district: string | null;
  office: "S" | "H" | "P";
  receipts: number | null;
  disbursements: number | null;
  cash_on_hand_end_period: number | string | null;
  coverage_end_date: string | null;
  incumbent_challenge: string | null;
  candidate_status: string | null;
  has_raised_funds?: boolean;
}

interface FecPage {
  pagination: { count: number; page: number; pages: number; per_page: number };
  results: FecTotalsRow[];
}

export interface MoneyOut {
  builtAt: string;
  apiKeyMode: "env" | "DEMO_KEY";
  offices: string[];
  endpoint: string;
  fecCandidates: number;
  matched: { candidates: number; races: number; ofCandidates: number; ofRaces: number };
  races: Record<string, ReturnType<typeof Money.parse>>;
  unmatchedFecTop: Array<{ id: string; name: string; state: string; district: string | null; party: string | null; receipts: number }>;
  note: string;
}

function fecParty(p: string | null): "D" | "R" | "I" | "L" | "G" | "O" | undefined {
  if (!p) return undefined;
  const u = p.toUpperCase();
  if (u === "DEM" || u === "DFL" || u === "DNL") return "D";
  if (u === "REP") return "R";
  if (u === "IND" || u === "NPA" || u === "NNE" || u === "UNA" || u === "NON") return "I";
  if (u === "LIB") return "L";
  if (u === "GRE" || u === "GRN") return "G";
  if (u === "UNK" || u === "W" || u === "OTH") return undefined;
  return "O";
}

const FEC_SUFFIX = /^(jr|sr|ii|iii|iv|v|mr|mrs|ms|dr|rev|hon|sen|rep|esq|phd|md)\.?$/i;

/** "LAST, FIRST MIDDLE SUFFIX" → "First Middle Last" (suffixes and single-letter initials dropped). */
function fecDisplayName(n: string): string {
  const [last, rest] = n.split(",").map((s) => s.trim());
  const given = (rest ?? "")
    .replace(/["“”][^"“”]*["“”]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((t) => t && !FEC_SUFFIX.test(t) && !/^[a-z]\.?$/i.test(t));
  const parts = rest ? `${given.join(" ")} ${last}` : n;
  return parts
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

/** Given-name tokens of an FEC record (everything after the comma, suffixes removed). */
function fecGivenTokens(n: string): string[] {
  const rest = n.split(",")[1] ?? "";
  return nameTokens(rest).filter((t) => !FEC_SUFFIX.test(t));
}
function fecLastTokens(n: string): string[] {
  return nameTokens(n.split(",")[0] ?? "");
}

export async function buildMoney(races: RaceMeta[], opts: { full: boolean; apiKey: string }): Promise<MoneyOut> {
  const demo = opts.apiKey === "DEMO_KEY";
  const offices = opts.full ? ["S", "H"] : ["S"];
  const out: MoneyOut = {
    builtAt: new Date().toISOString(),
    apiKeyMode: demo ? "DEMO_KEY" : "env",
    offices,
    endpoint: "/candidates/totals/?election_year=2026&cycle=2026&office=S|H (bulk receipts + cash on hand; one call per 100 candidates)",
    fecCandidates: 0,
    matched: { candidates: 0, races: 0, ofCandidates: 0, ofRaces: 0 },
    races: {},
    unmatchedFecTop: [],
    note: demo
      ? "DEMO_KEY (~30 req/hr): Senate only by default; pass --full to page House (~40 calls, auto-resumes from cache after 429 waits). Set FEC_API_KEY for 1,000/hr."
      : "FEC_API_KEY from environment.",
  };
  if (!opts.full) out.note += " House money skipped (run with --full).";

  const fec: FecTotalsRow[] = [];
  for (const office of offices) {
    let page = 1;
    let pages = 1;
    do {
      const url = `${FEC_BASE}/candidates/totals/?election_year=2026&cycle=2026&office=${office}&per_page=100&page=${page}&sort=-receipts&api_key=${encodeURIComponent(opts.apiKey)}`;
      const { data, res } = await fetchJson<FecPage>(url, {
        label: `fec:${office}:p${page}`,
        minSpacingMs: demo ? 2500 : 250,
        rateLimitWaitMs: demo ? 5 * 60_000 : 60_000,
        maxRateLimitWaits: demo ? 14 : 5,
      });
      if (!data) {
        warn(`FEC totals ${office} page ${page} failed (HTTP ${res.status}); stopping ${office} pagination`);
        break;
      }
      pages = data.pagination.pages;
      fec.push(...data.results);
      if (!res.fromCache) info(`FEC ${office} page ${page}/${pages}`);
      page++;
    } while (page <= pages);
  }
  out.fecCandidates = fec.length;

  // index by state+office+district
  const idx = new Map<string, FecTotalsRow[]>();
  for (const r of fec) {
    const d = r.office === "H" ? (r.district === "00" || !r.district ? "AL" : r.district.padStart(2, "0")) : "";
    const key = `${r.office}:${r.state}:${d}`;
    const arr = idx.get(key) ?? [];
    arr.push(r);
    idx.set(key, arr);
  }

  const used = new Set<string>();
  let asOf = "";
  for (const race of races) {
    if (race.office !== "senate" && race.office !== "house") continue;
    const office = race.office === "senate" ? "S" : "H";
    if (!offices.includes(office)) continue;
    const key = `${office}:${race.state}:${office === "H" ? race.district : ""}`;
    const pool = idx.get(key) ?? [];
    if (pool.length === 0) continue;
    out.matched.ofRaces++;
    const receipts: Record<string, number> = {};
    const cash: Record<string, number> = {};
    let any = false;
    // Incumbents first, and never reuse an FEC record: namesakes (AK Dan S./Dan J. Sullivan) must not share one.
    for (const c of [...race.candidates].sort((a, b) => Number(b.incumbent) - Number(a.incumbent))) {
      out.matched.ofCandidates++;
      const ln = lastName(c.name);
      const fn = firstName(c.name);
      const full = normName(c.name);
      const candToks = nameTokens(c.name);
      // surname match: FEC surname equals ours, or our surname appears anywhere in the FEC name ("ARENHOLZ, ASHLEY HINSON")
      const cands = pool.filter((f) => {
        if (used.has(f.candidate_id)) return false;
        const fl = fecLastTokens(f.name);
        return fl.includes(ln) || fl.join("") === ln || fecGivenTokens(f.name).includes(ln) || (fl.length > 1 && candToks.includes(fl[fl.length - 1]));
      });
      let best: FecTotalsRow | undefined;
      const exact = cands.filter((f) => normName(fecDisplayName(f.name)) === full);
      const firstOk = (f: FecTotalsRow) => {
        const given = fecGivenTokens(f.name);
        if (given.length === 0) return true;
        if (given.some((g) => firstNamesMatch(g, fn))) return true;
        // our middle tokens vs their given names ("Garland Andy Barr" vs "Andy Barr"; "T. Jonathan Ossoff" vs "Jon Ossoff")
        return candToks.slice(0, -1).some((t) => given.some((g) => firstNamesMatch(g, t)));
      };
      const sameParty = (f: FecTotalsRow) => fecParty(f.party) === c.party;
      let shortlist = (exact.length ? exact : cands).filter(firstOk);
      if (shortlist.length === 0 && cands.length) {
        // a unique same-party surname match within this race's pool is good enough
        const sp = cands.filter(sameParty);
        if (sp.length === 1) shortlist = sp;
      }
      const scored = shortlist
        .map((f) => {
          const fp = fecParty(f.party);
          let score = 0;
          if (fp === c.party) score += 3;
          else if (fp && fp !== c.party && (c.party === "D" || c.party === "R")) score -= 4;
          if (f.incumbent_challenge === "I" && c.incumbent) score += 2;
          if ((f.receipts ?? 0) > 0) score += 1;
          if (f.candidate_status === "C") score += 1;
          return { f, score };
        })
        .sort((a, b) => b.score - a.score || (b.f.receipts ?? 0) - (a.f.receipts ?? 0));
      if (scored.length && scored[0].score >= 0) best = scored[0].f;
      if (!best) continue;
      used.add(best.candidate_id);
      c.fecId = best.candidate_id;
      const alias = fecDisplayName(best.name);
      const lastOf = (n: string) => normName(n).split(" ").pop();
      const firstOf = (n: string) => normName(n).split(" ")[0];
      const hasNamesake = race.candidates.some((o) => o !== c && lastOf(o.name) === lastOf(c.name) && firstOf(o.name) === firstOf(c.name));
      if (!hasNamesake && !c.aliases.includes(alias)) c.aliases.push(alias);
      receipts[c.id] = Math.round(Number(best.receipts ?? 0));
      cash[c.id] = Math.round(Number(best.cash_on_hand_end_period ?? 0));
      if (best.coverage_end_date && best.coverage_end_date > asOf) asOf = best.coverage_end_date;
      out.matched.candidates++;
      any = true;
    }
    if (any) {
      const m = Money.parse({ receipts, cashOnHand: cash, asOf: asOf || undefined });
      race.money = m;
      out.races[race.id] = m;
      out.matched.races++;
    }
  }
  out.unmatchedFecTop = fec
    .filter((f) => !used.has(f.candidate_id) && (f.receipts ?? 0) > 250_000 && f.candidate_status === "C")
    .sort((a, b) => (b.receipts ?? 0) - (a.receipts ?? 0))
    .slice(0, 40)
    .map((f) => ({ id: f.candidate_id, name: f.name, state: f.state, district: f.district, party: f.party, receipts: Math.round(f.receipts ?? 0) }));
  info(`FEC: ${out.fecCandidates} rows; matched ${out.matched.candidates}/${out.matched.ofCandidates} candidates in ${out.matched.races} races`);
  return out;
}
