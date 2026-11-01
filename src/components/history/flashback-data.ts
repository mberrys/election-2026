import { mapSimilarity, sideOf, type HistoryRowModel } from "@/analytics/history";
import { lastTimeSentence } from "./summary";

/** Presidential nominees by year, Democrat first. */
export const MATCHUPS: Record<number, readonly [string, string]> = {
  1976: ["Carter", "Ford"],
  1980: ["Carter", "Reagan"],
  1984: ["Mondale", "Reagan"],
  1988: ["Dukakis", "Bush"],
  1992: ["Clinton", "Bush"],
  1996: ["Clinton", "Dole"],
  2000: ["Gore", "Bush"],
  2004: ["Kerry", "Bush"],
  2008: ["Obama", "McCain"],
  2012: ["Obama", "Romney"],
  2016: ["Clinton", "Trump"],
  2020: ["Biden", "Trump"],
  2024: ["Harris", "Trump"],
};

export interface FlashbackStep {
  year: number;
  /** The last step: 2026 from polls, not a result. */
  projected: boolean;
  /** National margin: presidential popular vote, or the generic ballot for 2026. */
  national?: number;
  matchup?: readonly [string, string];
  /** States (and DC) on each side that year; zero counts as D. */
  dWon: number;
  rWon: number;
}

export interface FlashbackPlace {
  id: string;
  name: string;
  /** One margin per step (D − R points), aligned with `steps`; null where there is no figure. */
  margins: Array<number | null>;
  /** "Projected D+4.0: last this Democratic in 2008 (D+10.3)." */
  sentence: string;
  /** Where the 2026 figure comes from, in plain words. */
  basis?: string;
}

export interface FlashbackFinding {
  year: number;
  /** Mean absolute gap between the projected and actual state margins, in points. */
  meanGap: number;
  sameSide: number;
  n: number;
  /** First year in the comparison, for "closer than any election since …". */
  since: number;
}

export interface FlashbackData {
  steps: FlashbackStep[];
  places: Record<string, FlashbackPlace>;
  nationSentence: string;
  finding?: FlashbackFinding;
  asOf?: string;
}

const round2 = (m: number | undefined) => (m === undefined || !Number.isFinite(m) ? null : Math.round(m * 100) / 100);
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : dayFmt.format(t);
};

/** "Governor poll average, 6 polls to Oct 25" or the swing fallback. */
export function projectionBasis(row: HistoryRowModel): string | undefined {
  const p = row.projection;
  if (!p) return undefined;
  if (p.source === "poll" && p.poll) {
    const [office, rest = ""] = p.poll.raceId.split(":");
    const name = office === "governor" ? "Governor" : office === "senate" ? (rest.endsWith("special") ? "Senate special" : "Senate") : office;
    return `${name} poll average, ${p.poll.n} poll${p.poll.n === 1 ? "" : "s"} to ${fmtDay(p.poll.asOf)}.`;
  }
  return "No statewide poll: the 2024 margin moved by the national swing since then.";
}

/**
 * Everything the Flashback time machine needs, in one small payload: per-state margins for each presidential
 * election plus the 2026 projection, the national figure per step, and the past election the 2026 map is closest to.
 */
export function buildFlashback(nation: HistoryRowModel, states: HistoryRowModel[], years: number[], asOf?: string): FlashbackData {
  const places: Record<string, FlashbackPlace> = {};
  for (const r of states) {
    places[r.id] = {
      id: r.id,
      name: r.label,
      margins: [...years.map((y) => round2(r.series[String(y)])), round2(r.projection?.margin)],
      sentence: lastTimeSentence(r, "pres"),
      basis: projectionBasis(r),
    };
  }

  const count = (i: number) => {
    let d = 0;
    let rr = 0;
    for (const p of Object.values(places)) {
      const m = p.margins[i];
      if (m === null) continue;
      if (sideOf(m) === "D") d++;
      else rr++;
    }
    return { dWon: d, rWon: rr };
  };

  const steps: FlashbackStep[] = years.map((year, i) => ({
    year,
    projected: false,
    national: round2(nation.series[String(year)]) ?? undefined,
    matchup: MATCHUPS[year],
    ...count(i),
  }));
  steps.push({ year: 2026, projected: true, national: round2(nation.projection?.margin) ?? undefined, ...count(years.length) });

  const projected: Record<string, number> = {};
  for (const r of states) if (r.projection) projected[r.id] = r.projection.margin;
  const best = mapSimilarity(
    projected,
    Object.fromEntries(states.map((r) => [r.id, r.series])),
    years,
  )[0];

  return {
    steps,
    places,
    nationSentence: lastTimeSentence(nation, "pres"),
    finding: best ? { ...best, meanGap: Math.round(best.meanGap * 10) / 10, since: years[0] } : undefined,
    asOf,
  };
}
