/**
 * Swing vs 2024 and a diverging-scale position helper (no color libraries; the caller maps t to a color).
 */

/** Current D - R margin minus the 2024 D - R margin; positive = moved toward D. */
export function swingVs2024(unitMarginNow: number, unitMargin2024: number): number {
  return unitMarginNow - unitMargin2024;
}

export const DEFAULT_SWING_RANGE = 30;

/**
 * Map a signed value in [-range, +range] to t in [0, 1] with 0 -> 0.5 (diverging scale centre).
 * Values beyond the range clamp to 0 or 1.
 */
export function divergingT(value: number, range = DEFAULT_SWING_RANGE): number {
  if (!(range > 0)) return 0.5;
  const t = (value + range) / (2 * range);
  return Math.min(1, Math.max(0, t));
}
