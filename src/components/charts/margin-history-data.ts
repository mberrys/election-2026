import type { History } from "@/data/schema";
import { fmtMarginDR } from "@/lib/format";

export type HistoryOffice = "senate" | "governor";

export interface MarginHistoryModel {
  abbr: string;
  /** Presidential margin in the state (D minus R, points), by election year, ascending. */
  bars: { year: number; margin: number }[];
  /** National popular-vote margin for the same years. */
  nation: { year: number; margin: number }[];
  /** The state's past races for one office, by year, ascending. */
  races: { year: number; margin: number }[];
  raceLabel?: string;
}

const OFFICE_LABEL: Record<HistoryOffice, string> = { senate: "Senate", governor: "Governor" };

const asSeries = (s: Record<string, number> | undefined) =>
  Object.entries(s ?? {})
    .map(([y, margin]) => ({ year: Number(y), margin }))
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.margin))
    .sort((a, b) => a.year - b.year);

/** Gathers the series for the chart; undefined when the state has no presidential history. */
export function buildMarginHistory(history: History, abbr: string, office?: HistoryOffice): MarginHistoryModel | undefined {
  const row = history.states[abbr];
  if (!row) return undefined;
  const bars = asSeries(row.pres);
  if (bars.length < 2) return undefined;
  const nation = bars.flatMap((b) => {
    const n = history.national.pres[String(b.year)];
    return n ? [{ year: b.year, margin: n.margin }] : [];
  });
  const races = office ? asSeries(row[office]) : [];
  return { abbr, bars, nation, races, raceLabel: office && races.length ? OFFICE_LABEL[office] : undefined };
}

const COUNT_WORD = ["none", "one", "two", "three", "four"];
const sideName = (m: number) => (m > 0 ? "Democratic" : "Republican");
const pts = (m: number) => `${Math.abs(m).toFixed(1)} points`;

/** One sentence, stated from the data. Closeness first, then a long streak, then the last two elections. */
export function historyTakeaway(model: MarginHistoryModel, stateName: string): string | undefined {
  const bars = model.bars;
  if (bars.length < 2) return undefined;

  const last4 = bars.slice(-4);
  if (last4.length === 4) {
    const close = last4.filter((b) => Math.abs(b.margin) <= 3).length;
    if (close === 4) return `${stateName} has voted within 3 points in each of the last four presidential elections.`;
    if (close >= 2) return `${stateName} has voted within 3 points in ${COUNT_WORD[close]} of the last four presidential elections.`;
  }

  const lastMargin = bars[bars.length - 1].margin;
  if (lastMargin !== 0) {
    let streak = 0;
    for (let i = bars.length - 1; i >= 0 && Math.sign(bars[i].margin) === Math.sign(lastMargin); i--) streak++;
    if (streak >= 3) {
      const run = bars.slice(-streak);
      const avg = run.reduce((s, b) => s + Math.abs(b.margin), 0) / run.length;
      const span = streak === bars.length ? `every presidential election since ${bars[0].year}` : `each of the last ${streak} presidential elections`;
      return `${stateName} has voted ${sideName(lastMargin)} in ${span}, by ${avg.toFixed(1)} points on average.`;
    }
  }

  const [prev, cur] = bars.slice(-2);
  if (cur.margin === 0 || prev.margin === 0) return `${stateName} voted ${fmtMarginDR(cur.margin)} for president in ${cur.year}.`;
  if (Math.sign(prev.margin) !== Math.sign(cur.margin)) {
    return `${stateName} moved from ${sideName(prev.margin)} in ${prev.year} to ${sideName(cur.margin)} in ${cur.year}, by ${pts(cur.margin)}.`;
  }
  return `${stateName} voted ${sideName(cur.margin)} in ${cur.year} by ${pts(cur.margin)}.`;
}
