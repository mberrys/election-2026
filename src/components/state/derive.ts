/**
 * Pure helpers for the state board: merge live reporting units with county baselines into
 * one row shape the map, table, "what's left" bars and bellwether cards all read from.
 * Everything here is deterministic and safe to run during prerender.
 */
import {
  PRES_TO_MIDTERM_TURNOUT_RATIO,
  expectedStateMargin,
  tallyByParty,
  uniformSwingBenchmark,
} from "@/analytics";
import type { CountyBaseline } from "@/data/reference/load";
import { RATING_ORDER, type Party, type Race, type RaceMeta, type StateMeta, type VoteModes } from "@/data/schema";

export type CountyBaselines = Record<string, CountyBaseline>;

export interface ModesPresent {
  early: boolean;
  mail: boolean;
  eday: boolean;
}

export interface CountyRow {
  /** fips when known, else the feed's unit id */
  id: string;
  fips?: string;
  name: string;
  /** true when this row comes from a live reporting unit (not just a baseline) */
  live: boolean;
  votesIn: number;
  expected?: number;
  remaining?: number;
  /** 0–1 */
  pctIn?: number;
  dVotes: number;
  rVotes: number;
  dPct?: number;
  rPct?: number;
  /** live D − R points */
  margin?: number;
  margin2024?: number;
  margin2020?: number;
  benchmark?: number;
  overUnder?: number;
  /** 0–100; outside that range = impossible */
  needs?: number;
  modes: ModesPresent;
  precinctsReporting?: number;
  precinctsTotal?: number;
}

export function partyMap(race?: Race, meta?: RaceMeta): Map<string, Party> {
  const m = new Map<string, Party>();
  for (const c of meta?.candidates ?? []) m.set(c.id, c.party);
  for (const c of race?.candidates ?? []) m.set(c.id, c.party);
  return m;
}

export function modesPresent(modes: VoteModes | undefined): ModesPresent {
  return {
    early: (modes?.early ?? 0) > 0,
    mail: (modes?.mail ?? 0) > 0,
    eday: (modes?.electionDay ?? 0) > 0,
  };
}

const NO_MODES: ModesPresent = { early: false, mail: false, eday: false };

function normFips(unit: { id: string; fips?: string }): string | undefined {
  const raw = unit.fips ?? (/^\d{4,5}$/.test(unit.id) ? unit.id : undefined);
  return raw ? raw.padStart(5, "0") : undefined;
}

/** Benchmark (expected D − R) for a county given its 2024 margin, via uniform swing from the state expectation. */
export function makeBenchmark(meta: RaceMeta | undefined) {
  const stateM24 = meta?.baseline.presMargin2024;
  const stateExp = expectedStateMargin(meta);
  return (m24: number | undefined): number => {
    if (m24 == null) return stateExp;
    if (stateM24 == null) return m24;
    return uniformSwingBenchmark(m24, stateM24, stateExp);
  };
}

/**
 * One row per county: live units first (enriched with baselines), then baseline-only counties the feed
 * has not mentioned yet. With no live race at all, every row is a pre-election baseline row.
 */
export function buildCountyRows(race: Race | undefined, meta: RaceMeta | undefined, counties: CountyBaselines): CountyRow[] {
  const partyOf = partyMap(race, meta);
  const bench = makeBenchmark(meta);
  const rows = new Map<string, CountyRow>();

  for (const u of race?.units ?? []) {
    const fips = normFips(u);
    const base = fips ? counties[fips] : undefined;
    const t = tallyByParty(u.votes, partyOf);
    const votesIn = u.totalVotes > 0 ? u.totalVotes : t.total;
    const expected =
      u.expectedVote ?? (base?.turnout2024 != null ? base.turnout2024 * PRES_TO_MIDTERM_TURNOUT_RATIO : undefined);
    const pctIn = u.pctExpected ?? (expected ? Math.min(1, votesIn / expected) : undefined);
    const margin = u.margin ?? (votesIn > 0 ? ((t.d - t.r) / votesIn) * 100 : undefined);
    const m24 = u.baselineMargin2024 ?? base?.margin2024;
    const benchmark = u.benchmarkMargin ?? bench(m24);
    const overUnder = u.overUnder ?? (margin != null ? margin - benchmark : undefined);
    const key = fips ?? u.id;
    rows.set(key, {
      id: key,
      fips,
      name: u.name || base?.name || key,
      live: true,
      votesIn,
      expected,
      remaining: expected != null ? Math.max(0, expected - votesIn) : undefined,
      pctIn,
      dVotes: t.d,
      rVotes: t.r,
      dPct: votesIn > 0 ? (t.d / votesIn) * 100 : undefined,
      rPct: votesIn > 0 ? (t.r / votesIn) * 100 : undefined,
      margin,
      margin2024: m24,
      margin2020: base?.margin2020,
      benchmark,
      overUnder,
      needs: u.needsOfRemaining,
      modes: modesPresent(u.modes),
      precinctsReporting: u.precinctsReporting,
      precinctsTotal: u.precinctsTotal,
    });
  }

  for (const [fips, c] of Object.entries(counties)) {
    if (rows.has(fips)) continue;
    const expected = c.turnout2024 != null ? c.turnout2024 * PRES_TO_MIDTERM_TURNOUT_RATIO : undefined;
    rows.set(fips, {
      id: fips,
      fips,
      name: c.name,
      live: false,
      votesIn: 0,
      expected,
      remaining: expected,
      pctIn: 0,
      dVotes: 0,
      rVotes: 0,
      margin2024: c.margin2024,
      margin2020: c.margin2020,
      benchmark: bench(c.margin2024),
      modes: NO_MODES,
    });
  }

  return [...rows.values()];
}

/** Turnout-weighted statewide 2024/2020 margins from county baselines (fallback when the race meta lacks them). */
export function stateBaselineFromCounties(counties: CountyBaselines): { margin2024?: number; margin2020?: number } {
  let w24 = 0;
  let s24 = 0;
  let w20 = 0;
  let s20 = 0;
  for (const c of Object.values(counties)) {
    if (c.margin2024 != null && c.turnout2024) {
      w24 += c.turnout2024;
      s24 += c.margin2024 * c.turnout2024;
    }
    if (c.margin2020 != null && c.turnout2020) {
      w20 += c.turnout2020;
      s20 += c.margin2020 * c.turnout2020;
    }
  }
  return { margin2024: w24 ? s24 / w24 : undefined, margin2020: w20 ? s20 / w20 : undefined };
}

// ---------- race selection ----------

/** 0 = toss-up … 4 = solid; 9 = unrated. */
export function competitiveness(meta: RaceMeta): number {
  const c = meta.ratings.consensus;
  if (!c) return 9;
  return Math.abs(RATING_ORDER.indexOf(c) - 4);
}

const OFFICE_PRIORITY: Record<string, number> = { senate: 0, governor: 1, house: 2, ballot: 3, stateleg: 4 };

export interface SelectorGroups {
  senate: RaceMeta[];
  governor: RaceMeta[];
  house: RaceMeta[];
  ballot: RaceMeta[];
}

export function groupRaces(metas: RaceMeta[]): SelectorGroups {
  const byDistrict = (a: RaceMeta, b: RaceMeta) => (a.district ?? "").localeCompare(b.district ?? "");
  return {
    senate: metas.filter((m) => m.office === "senate").sort((a, b) => Number(a.special) - Number(b.special)),
    governor: metas.filter((m) => m.office === "governor"),
    house: metas.filter((m) => m.office === "house").sort(byDistrict),
    ballot: metas.filter((m) => m.office === "ballot").sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Most competitive statewide race (Senate beats Governor on ties), else the first House district, else a measure. */
export function pickDefaultRace(metas: RaceMeta[]): string | undefined {
  const statewide = metas
    .filter((m) => m.office === "senate" || m.office === "governor")
    .sort(
      (a, b) =>
        competitiveness(a) - competitiveness(b) ||
        OFFICE_PRIORITY[a.office] - OFFICE_PRIORITY[b.office] ||
        Number(a.special) - Number(b.special),
    );
  if (statewide[0]) return statewide[0].id;
  const g = groupRaces(metas);
  return g.house[0]?.id ?? g.ballot[0]?.id;
}

export function raceTabLabel(meta: RaceMeta): string {
  switch (meta.office) {
    case "senate":
      return meta.special ? "Senate (special)" : "Senate";
    case "governor":
      return "Governor";
    case "house":
      return `${meta.state}-${meta.district ?? "AL"}`;
    case "ballot": {
      const stripped = meta.name.replace(/^[A-Za-z .]+?\s(?=[A-Z])/, "");
      return stripped.length > 34 ? `${stripped.slice(0, 32)}…` : stripped;
    }
    default:
      return meta.name;
  }
}

// ---------- mirage badge ----------

export interface MirageInfo {
  label: string;
  lean: "D" | "R" | null;
  present: ModesPresent;
  note?: string;
}

export function mirageInfo(state: Pick<StateMeta, "voteOrder" | "voteOrderNote">, race?: Race): MirageInfo {
  const present = modesPresent(race?.modes);
  const pctIn = race?.pctExpected ?? 0;
  const anyPresent = present.early || present.mail || present.eday;
  switch (state.voteOrder) {
    case "early-first": {
      const late = anyPresent && present.eday && pctIn > 0.5;
      return {
        label: late
          ? "Election Day vote now arriving; expect drift toward R"
          : "Early & mail counted first, so early numbers lean D",
        lean: late ? "R" : "D",
        present,
        note: state.voteOrderNote,
      };
    }
    case "eday-first": {
      const late = anyPresent && (present.early || present.mail) && pctIn > 0.5;
      return {
        label: late
          ? "Early & mail vote now arriving; expect drift toward D"
          : "Election Day counted first, so early numbers lean R",
        lean: late ? "D" : "R",
        present,
        note: state.voteOrderNote,
      };
    }
    case "mixed":
      return { label: "Mixed reporting order: early numbers are noisy", lean: null, present, note: state.voteOrderNote };
    default:
      return { label: "Reporting order not documented", lean: null, present, note: state.voteOrderNote };
  }
}

export const TIER_SOURCE_LABEL: Record<"A" | "B" | "C", string> = {
  A: "official statewide feed",
  B: "county feeds",
  C: "delayed / community sources",
};
