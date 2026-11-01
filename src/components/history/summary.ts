import type { HistoryRowModel } from "@/analytics/history";
import { fmtMarginDR } from "@/lib/format";

export const YARDSTICK_LABEL: Record<string, string> = {
  pres: "presidential",
  senate: "Senate",
  governor: "governor",
  house: "House",
};

/** Headline sentence: projection, the last election at or beyond it, and the change from the latest election. */
export function lastTimeSentence(row: HistoryRowModel, yardstick: string): string {
  const p = row.projection;
  if (!p) return "No poll or baseline to project from yet.";
  const noun = YARDSTICK_LABEL[yardstick] ?? yardstick;
  const side = p.margin >= 0 ? "Democratic" : "Republican";
  const ys = Object.keys(row.series).map(Number);
  if (row.lastTime === undefined) {
    return `Projected ${fmtMarginDR(p.margin)}: no ${noun} election from ${Math.min(...ys)} to ${Math.max(...ys)} was as ${side} as that.`;
  }
  const m = row.series[String(row.lastTime)];
  const latest = row.latestYear;
  if (row.lastTime === latest) {
    const delta = p.margin - m;
    if (Math.abs(delta) < 2) return `Projected ${fmtMarginDR(p.margin)}, about where it voted in ${latest} (${fmtMarginDR(m)}).`;
    // The latest election was already at least this far toward the projected side, so the projection is a move back
    // toward the middle (or the other side). Say that, and point to the closest past result instead.
    const toward = delta > 0 ? "Democratic" : "Republican";
    const near = row.closest !== undefined && row.closest !== latest ? ` Closest past result: ${row.closest} (${fmtMarginDR(row.series[String(row.closest)])}).` : "";
    return `Projected ${fmtMarginDR(p.margin)}, ${Math.abs(delta).toFixed(1)} points more ${toward} than in ${latest} (${fmtMarginDR(m)}).${near}`;
  }
  return `Projected ${fmtMarginDR(p.margin)}: last this ${side} in ${row.lastTime} (${fmtMarginDR(m)}).`;
}
