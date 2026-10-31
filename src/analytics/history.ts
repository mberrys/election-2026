/**
 * "Then & Now": project each unit from current polling, then find the last election it voted that way.
 * All margins are D - R in points; negative = R. Polls are used as published (no house-effect adjustment).
 */
import type { DistrictHistory, History, MarginSeries, RaceMeta } from "../data/schema";

const logit = (x: number) => Math.log(x / (1 - x));
const twoPartyShare = (marginPts: number) => Math.min(Math.max((100 + marginPts) / 200, 0.001), 0.999);

/**
 * Move a unit's margin by the national swing measured on the logit of the two-party share. Matches a uniform swing
 * near 50-50 but stays bounded in lopsided places (a flat +10 would push DC past D+90).
 */
export function logitSwing(unitMargin: number, nationalBaseline: number, nationalNow: number): number {
  const shift = logit(twoPartyShare(nationalNow)) - logit(twoPartyShare(nationalBaseline));
  const s = 1 / (1 + Math.exp(-(logit(twoPartyShare(unitMargin)) + shift)));
  return 200 * s - 100;
}

export type ProjectionSource = "poll" | "swing";

export interface Projection {
  margin: number;
  source: ProjectionSource;
  /** Poll details when source is "poll". */
  poll?: { raceId: string; d: number; r: number; n: number; asOf: string; pollster: string };
}

export interface ProjectionContext {
  /** National generic-ballot margin. */
  genericMargin?: number;
  /** National presidential margin in the baseline year (2024), the swing anchor. */
  nationalBaseline?: number;
  /** Added to every poll-derived margin. Defaults to 0: polls are shown as published. */
  pollShift?: number;
}

/** Poll margin when the race has an average; otherwise the 2024 margin moved by the national (logit) swing since 2024. */
export function projectedMargin(
  meta: Pick<RaceMeta, "id" | "polls" | "baseline">,
  baseline2024: number | undefined,
  ctx: ProjectionContext,
): Projection | undefined {
  const shift = ctx.pollShift ?? 0;
  if (meta.polls) {
    const { d, r, n, asOf, source } = meta.polls;
    return { margin: d - r + shift, source: "poll", poll: { raceId: meta.id, d, r, n, asOf, pollster: source } };
  }
  if (baseline2024 !== undefined && ctx.genericMargin !== undefined && ctx.nationalBaseline !== undefined) {
    return { margin: logitSwing(baseline2024, ctx.nationalBaseline, ctx.genericMargin) + shift, source: "swing" };
  }
  return undefined;
}

const years = (s: MarginSeries) =>
  Object.keys(s)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

export type Side = "D" | "R";
export const sideOf = (margin: number): Side => (margin >= 0 ? "D" : "R");

/**
 * Most recent election whose margin was at least as far toward the projected side as the projection
 * ("not this blue since 1976"). A margin of exactly zero counts as D. Undefined when no election in the series
 * reached it.
 */
export function lastTimeAtOrBeyond(series: MarginSeries, margin: number): number | undefined {
  const side = sideOf(margin);
  const ys = years(series);
  for (let i = ys.length - 1; i >= 0; i--) {
    const m = series[String(ys[i])];
    if (side === "D" ? m >= margin : m <= margin) return ys[i];
  }
  return undefined;
}

/** Election whose margin is nearest the projection; ties go to the more recent one. */
export function closestYear(series: MarginSeries, margin: number): number | undefined {
  let best: { y: number; gap: number } | undefined;
  for (const y of years(series)) {
    const gap = Math.abs(series[String(y)] - margin);
    if (!best || gap <= best.gap) best = { y, gap };
  }
  return best?.y;
}

export interface Swing {
  from: number;
  to: number;
  /** Change in D-R margin from `from` to `to`; positive = moved toward D. */
  delta: number;
}

/** Election-to-election change in margin. */
export function swingSeries(series: MarginSeries): Swing[] {
  const ys = years(series);
  const out: Swing[] = [];
  for (let i = 1; i < ys.length; i++) {
    out.push({ from: ys[i - 1], to: ys[i], delta: series[String(ys[i])] - series[String(ys[i - 1])] });
  }
  return out;
}

/** Latest election in a series. */
export function latestYear(series: MarginSeries): number | undefined {
  const ys = years(series);
  return ys[ys.length - 1];
}

export type Yardstick = "pres" | "senate" | "governor" | "house";

export interface HistoryRowModel {
  id: string;
  label: string;
  kind: "nation" | "state" | "district";
  series: MarginSeries;
  projection?: Projection;
  /** Margin of the latest election in `series`. */
  latestMargin?: number;
  latestYear?: number;
  lastTime?: number;
  closest?: number;
  /** Projected margin minus the latest election's margin. */
  change?: number;
  caveat?: DistrictHistory["caveat"];
}

function finishRow(base: Omit<HistoryRowModel, "latestMargin" | "latestYear" | "lastTime" | "closest" | "change">): HistoryRowModel {
  const ly = latestYear(base.series);
  const lm = ly !== undefined ? base.series[String(ly)] : undefined;
  const p = base.projection?.margin;
  return {
    ...base,
    latestYear: ly,
    latestMargin: lm,
    lastTime: p !== undefined ? lastTimeAtOrBeyond(base.series, p) : undefined,
    closest: p !== undefined ? closestYear(base.series, p) : undefined,
    change: p !== undefined && lm !== undefined ? p - lm : undefined,
  };
}

/** Which statewide race supplies a state's poll: regular Senate, then Senate special, then Governor. */
export function statewideRace(races: RaceMeta[]): RaceMeta | undefined {
  const withPolls = (o: RaceMeta["office"], special: boolean) => races.find((r) => r.office === o && !!r.special === special && r.polls);
  return withPolls("senate", false) ?? withPolls("senate", true) ?? withPolls("governor", false);
}

/** Then & Now row for one race: its own poll average when it has one, else its 2024 margin moved by the national swing. */
export function raceRow(meta: RaceMeta, series: MarginSeries, baseline2024: number | undefined, input: BuildInput, label: string): HistoryRowModel {
  const projection = projectedMargin(meta, baseline2024, ctx(input, latestNational(input.history)));
  return finishRow({ id: meta.id, label, kind: meta.office === "house" ? "district" : "state", series, projection });
}

export interface BuildInput {
  history: History;
  races: RaceMeta[];
  stateNames: Record<string, string>;
  genericMargin?: number;
  pollShift?: number;
}

/** One national row from the generic ballot against the presidential popular-vote history. */
export function nationRow(input: Pick<BuildInput, "history" | "genericMargin" | "pollShift">): HistoryRowModel {
  const series: MarginSeries = Object.fromEntries(Object.entries(input.history.national.pres).map(([y, v]) => [y, v.margin]));
  const projection: Projection | undefined =
    input.genericMargin !== undefined ? { margin: input.genericMargin + (input.pollShift ?? 0), source: "poll" } : undefined;
  return finishRow({ id: "US", label: "United States", kind: "nation", series, projection });
}

export function stateRows(input: BuildInput, yardstick: Yardstick): HistoryRowModel[] {
  const { history, races, stateNames } = input;
  const nationalBaseline = latestNational(history);
  const byState = new Map<string, RaceMeta[]>();
  for (const r of races) (byState.get(r.state) ?? byState.set(r.state, []).get(r.state)!).push(r);
  const rows: HistoryRowModel[] = [];
  for (const [abbr, h] of Object.entries(history.states)) {
    const series = h[yardstick === "house" ? "pres" : yardstick];
    if (!Object.keys(series).length) continue;
    const rs = byState.get(abbr) ?? [];
    const lead = statewideRace(rs);
    const pres24 = history.states[abbr]?.pres["2024"];
    const projection = projectedMargin(lead ?? { id: `state:${abbr}`, polls: undefined, baseline: {} }, pres24, ctx(input, nationalBaseline));
    rows.push(finishRow({ id: abbr, label: stateNames[abbr] ?? abbr, kind: "state", series, projection }));
  }
  return rows;
}

export function districtRows(input: BuildInput, yardstick: "house" | "pres"): HistoryRowModel[] {
  const { history, races } = input;
  const nationalBaseline = latestNational(history);
  const rows: HistoryRowModel[] = [];
  for (const r of races) {
    if (r.office !== "house" || !r.district) continue;
    const id = `${r.state}-${r.district}`;
    const d = history.districts[id];
    if (!d) continue;
    const series = yardstick === "house" ? d.house : d.pres;
    if (!Object.keys(series).length) continue;
    const projection = projectedMargin(r, d.pres["2024"], ctx(input, nationalBaseline));
    rows.push(finishRow({ id, label: id, kind: "district", series, projection, caveat: d.caveat }));
  }
  return rows;
}

const ctx = (input: BuildInput, nationalBaseline: number | undefined): ProjectionContext => ({
  genericMargin: input.genericMargin,
  nationalBaseline,
  pollShift: input.pollShift,
});

function latestNational(history: History): number | undefined {
  const ys = history.years;
  const y = ys[ys.length - 1];
  return y === undefined ? undefined : history.national.pres[String(y)]?.margin;
}

export type SortKey = "projected" | "lastTime" | "change" | "name";

/** Stable sort; rows without a projection go last. A projected row that never matched sorts as the oldest. */
export function sortRows(rows: HistoryRowModel[], key: SortKey): HistoryRowModel[] {
  const val = (r: HistoryRowModel): number | undefined =>
    key === "projected"
      ? r.projection?.margin
      : key === "lastTime"
        ? (r.lastTime ?? (r.projection ? Number.NEGATIVE_INFINITY : undefined))
        : key === "change"
          ? r.change
          : undefined;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (key === "name") return a.r.label.localeCompare(b.r.label) || a.i - b.i;
      const x = val(a.r);
      const y = val(b.r);
      if (x === undefined && y === undefined) return a.i - b.i;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      // Most Democratic first; oldest "last time" first (the rarest outcomes); biggest D move first.
      return key === "lastTime" ? x - y || a.i - b.i : y - x || a.i - b.i;
    })
    .map((x) => x.r);
}
