/** Shared helpers for the server-rendered SVG charts. Pure functions so they can be unit tested. */

const STEPS = [0.5, 1, 2, 5, 10, 20, 25, 50, 100];

export interface Scale {
  lo: number;
  hi: number;
  step: number;
  ticks: number[];
}

/**
 * Round, even ticks: 3 to 5 of them, the bottom at or below `min`, the top strictly above `max`.
 * Chosen as the smallest step that keeps the tick count at five or fewer.
 */
export function niceScale(min: number, max: number): Scale {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  let pick: Scale | undefined;
  for (const step of STEPS) {
    const lo = Math.floor(a / step) * step;
    let hi = Math.floor(b / step) * step + step;
    while ((hi - lo) / step < 2) hi += step;
    const count = Math.round((hi - lo) / step) + 1;
    pick = { lo, hi, step, ticks: Array.from({ length: count }, (_, i) => +(lo + i * step).toFixed(6)) };
    if (count <= 5) break;
  }
  return pick!;
}

/**
 * Spreads labels vertically so neighbours stay at least `gap` apart, keeping them as close to their wanted y as
 * possible and inside [lo, hi]. Returns the placed y for each input, in input order.
 */
export function spreadLabels(wanted: number[], gap: number, lo: number, hi: number): number[] {
  const order = wanted.map((y, i) => ({ y, i })).sort((p, q) => p.y - q.y);
  const ys = order.map((o) => Math.min(Math.max(o.y, lo), hi));
  for (let k = 1; k < ys.length; k++) if (ys[k] - ys[k - 1] < gap) ys[k] = ys[k - 1] + gap;
  for (let k = ys.length - 1; k >= 0; k--) {
    if (ys[k] > hi) ys[k] = hi;
    if (k < ys.length - 1 && ys[k + 1] - ys[k] < gap) ys[k] = ys[k + 1] - gap;
  }
  const out = new Array<number>(wanted.length);
  order.forEach((o, k) => (out[o.i] = ys[k]));
  return out;
}

/** Short year: 1984 becomes ’84. */
export const shortYear = (y: number) => `’${String(y).slice(2)}`;
