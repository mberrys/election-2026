import type { RaceMeta, RatingCode } from "@/data/schema";
import { ratingLabel } from "@/lib/format";

export interface AxisMark {
  key: string;
  /** Short name under the value. */
  name: string;
  /** D minus R, points. For the forecast mark this is the centre of its band. */
  value: number;
  text: string;
  /** Margin range of the forecast band, drawn on the axis. */
  band?: [number, number];
  rating?: RatingCode;
}

/**
 * Margin range each rating covers, following the site's margin ramp (tilt under 2, lean 2 to 5, likely 5 to 10,
 * solid 10 and up). The ramp is a display convention, not a forecaster's definition.
 */
export function ratingBand(r: RatingCode): [number, number] {
  if (r === "tossup") return [-1, 1];
  const [a, b] = r.startsWith("tilt") ? [0, 2] : r.startsWith("lean") ? [2, 5] : r.startsWith("likely") ? [5, 10] : [10, 100];
  return r.endsWith("-d") ? [a, b] : [-b, -a];
}

const OFFICE_NAME: Record<string, string> = { senate: "Senate", governor: "Governor", house: "House" };

const sign = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "D" : "R"}+${Math.abs(m).toFixed(1)}`);

/** The marks to place on the number line, in reading order. Only data that exists. */
export function axisMarks(meta: RaceMeta): AxisMark[] {
  const out: AxisMark[] = [];
  const c = meta.ratings.consensus;
  if (c) {
    const band = ratingBand(c);
    const near = Math.min(Math.abs(band[0]), Math.abs(band[1]));
    const far = Math.max(Math.abs(band[0]), Math.abs(band[1]));
    const mid = c === "tossup" ? 0 : Math.sign(band[0] + band[1]) * ((near + Math.min(far, 20)) / 2);
    out.push({ key: "forecast", name: "Forecast", value: mid, text: ratingLabel[c], band, rating: c });
  }
  const p = meta.polls;
  if (p) out.push({ key: "poll", name: "Poll average", value: p.d - p.r, text: sign(p.d - p.r) });
  const b = meta.baseline;
  if (b.prevRaceMargin != null) {
    const o = OFFICE_NAME[meta.office];
    out.push({ key: "prev", name: b.prevRaceYear && o ? `${b.prevRaceYear} ${o}` : "Last race", value: b.prevRaceMargin, text: sign(b.prevRaceMargin) });
  }
  if (b.presMargin2024 != null) out.push({ key: "p24", name: "2024 president", value: b.presMargin2024, text: sign(b.presMargin2024) });
  if (b.presMargin2020 != null) out.push({ key: "p20", name: "2020 president", value: b.presMargin2020, text: sign(b.presMargin2020) });
  return out;
}

/** One sentence comparing the poll average with the 2024 presidential result, when both exist. */
export function axisTakeaway(marks: AxisMark[]): string | undefined {
  const poll = marks.find((m) => m.key === "poll");
  const pres = marks.find((m) => m.key === "p24");
  if (!poll || !pres) return undefined;
  const shift = poll.value - pres.value;
  if (Math.abs(shift) < 1) return "Polls sit close to the 2024 presidential result.";
  return `Polls run ${Math.abs(shift).toFixed(1)} points more ${shift > 0 ? "Democratic" : "Republican"} than the 2024 presidential result.`;
}

/** Half-width of the axis in points: 10, 20, 30 or 40, enough for every data mark (anything beyond is clamped at the edge). */
export function axisDomain(marks: AxisMark[]): number {
  const maxAbs = Math.max(0, ...marks.filter((m) => !m.band).map((m) => Math.abs(m.value)));
  return Math.min(40, Math.max(10, Math.ceil((maxAbs + 1) / 10) * 10));
}

export interface PlacedMark {
  mark: AxisMark;
  /** Pole x: where the mark sits on the axis. */
  x: number;
  /** Label text x, and which way the text runs from it. Labels sit beside the pole, like flags. */
  tx: number;
  anchor: "start" | "end";
  /** Horizontal extent of the label, including the gap to the pole. */
  from: number;
  to: number;
  /** Row, 0 nearest the axis. */
  lane: number;
}

const FLAG_GAP = 6;
/** One line: bold value, then the name in grey. Estimated width at 14px bold plus 13px regular. */
const labelWidth = (m: AxisMark) => m.text.length * 8.2 + 8 + m.name.length * 6.8;

function layout(marks: AxisMark[], xOf: (v: number) => number, width: number, dir: 1 | -1): { placed: PlacedMark[]; crossings: number; lanes: number } {
  // dir 1 places marks right to left and prefers labels running right; dir -1 is the mirror image.
  const sorted = [...marks].sort((a, b) => dir * (xOf(b.value) - xOf(a.value)));
  const placed: PlacedMark[] = [];
  for (const mark of sorted) {
    const w = labelWidth(mark);
    const x = xOf(mark.value);
    const geom = (anchor: "start" | "end") => {
      let from = anchor === "start" ? x : x - FLAG_GAP - w;
      let to = anchor === "start" ? x + FLAG_GAP + w : x;
      if (to > width) [from, to] = [from - (to - width), width];
      if (from < 0) [from, to] = [0, to - from];
      return { anchor, from, to };
    };
    const options = (dir === 1 ? ["start", "end"] : ["end", "start"]).map((a) => geom(a as "start" | "end"));
    const clashes = (lane: number, o: { from: number; to: number }, poles: boolean) =>
      placed.some((p) => {
        if (p.lane === lane) return o.from < p.to + 4 && o.to > p.from - 4;
        if (!poles) return false;
        if (p.lane < lane) return x > p.from - 3 && x < p.to + 3; // my pole would run through p's label
        return p.x > o.from - 3 && p.x < o.to + 3; // p's pole would run through my label
      });
    let pick: { lane: number; o: (typeof options)[number] } | undefined;
    for (let lane = 0; lane <= placed.length && !pick; lane++) pick = options.map((o) => ({ lane, o })).find(({ o }) => !clashes(lane, o, true));
    for (let lane = 0; !pick; lane++) pick = options.map((o) => ({ lane, o })).find(({ o }) => !clashes(lane, o, false));
    const { o, lane } = pick;
    placed.push({ mark, x, tx: o.anchor === "start" ? o.from + FLAG_GAP : o.to - FLAG_GAP, anchor: o.anchor, from: o.from, to: o.to, lane });
  }
  let crossings = 0;
  for (const a of placed) for (const b of placed) if (a.lane < b.lane && b.x > a.from && b.x < a.to) crossings++;
  return { placed, crossings, lanes: Math.max(0, ...placed.map((p) => p.lane + 1)) };
}

/**
 * Flag layout. Each mark is a pole on the axis with a one-line label beside it. Marks are placed in the lowest row
 * where the label clears the labels in that row and no pole runs through a label. Placing right to left with labels
 * running right (or left to right with labels running left) turns a cluster into a staircase whose poles miss every
 * label; both are tried and the one with fewer crossings, then fewer rows, wins. Same-row overlaps never happen.
 */
export function placeMarks(marks: AxisMark[], xOf: (v: number) => number, width: number): PlacedMark[] {
  const a = layout(marks, xOf, width, 1);
  const b = layout(marks, xOf, width, -1);
  return (a.crossings < b.crossings || (a.crossings === b.crossings && a.lanes <= b.lanes) ? a : b).placed;
}
