import type { CSSProperties } from "react";
import { loadHistory } from "@/data/reference/load";
import { fmtMarginDR } from "@/lib/format";
import { buildMarginHistory, historyTakeaway, type HistoryOffice, type MarginHistoryModel } from "./margin-history-data";
import { niceScale, shortYear, spreadLabels } from "./scale";

interface Dims {
  W: number;
  H: number;
  pad: { top: number; right: number; bottom: number; left: number };
  /** Label every other election with the short year on phones. */
  short: boolean;
}

const COMPACT: Dims = { W: 300, H: 250, pad: { top: 14, right: 84, bottom: 28, left: 40 }, short: true };
const WIDE: Dims = { W: 640, H: 300, pad: { top: 16, right: 116, bottom: 30, left: 46 }, short: false };
const FONT = 13;
const FIRST = 1974;
const LAST = 2026;

const axisText = (m: number) => (Math.abs(m) < 0.05 ? "0" : `${m > 0 ? "D" : "R"}+${Math.abs(m)}`);

function Chart({ model, stateName, dims, label }: { model: MarginHistoryModel; stateName: string; dims: Dims; label: string }) {
  const { W, H, pad } = dims;
  const all = [...model.bars, ...model.nation, ...model.races].map((p) => p.margin);
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all));
  const pw = W - pad.left - pad.right;
  const x = (year: number) => pad.left + ((year - FIRST) / (LAST - FIRST)) * pw;
  const y = (v: number) => pad.top + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * (H - pad.top - pad.bottom);
  const y0 = y(0);
  const barW = Math.max(5, Math.round(4 * 0.6 * (pw / (LAST - FIRST))));
  const nationPath = model.nation.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.margin).toFixed(1)}`).join("");

  const lastBar = model.bars[model.bars.length - 1];
  const lastNation = model.nation[model.nation.length - 1];
  const lastRace = model.races[model.races.length - 1];
  const raceYear = lastRace ? shortYear(lastRace.year) : "";

  // End labels: name over value, spread so they never collide, each tied to its mark by a hairline.
  const ends = [
    { key: "state", name: model.abbr, value: fmtMarginDR(lastBar.margin), ay: y(lastBar.margin), ax: x(lastBar.year) + barW / 2, color: lastBar.margin >= 0 ? "var(--party-d-ink)" : "var(--party-r-ink)" },
    ...(lastNation ? [{ key: "nation", name: "Nation", value: fmtMarginDR(lastNation.margin), ay: y(lastNation.margin), ax: x(lastNation.year), color: "var(--ink-muted)" }] : []),
    ...(lastRace && model.raceLabel ? [{ key: "race", name: `${dims.short && model.raceLabel === "Governor" ? "Gov" : model.raceLabel} ${raceYear}`, value: fmtMarginDR(lastRace.margin), ay: y(lastRace.margin), ax: x(lastRace.year) + 5, color: "var(--ink)" }] : []),
  ];
  const placed = spreadLabels(
    ends.map((e) => e.ay),
    34,
    pad.top + 12,
    H - pad.bottom - 22,
  );
  const lx = W - pad.right + 10;

  const xLabels = model.bars.filter((_, i) => i % 2 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {scale.ticks.map((t) => (
        <g key={t}>
          {t !== 0 && <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth={1} />}
          <text x={pad.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={FONT} fill="var(--ink-faint)" className="tnum">
            {axisText(t)}
          </text>
        </g>
      ))}

      {model.bars.map((b, i) => {
        const top = Math.min(y0, y(b.margin));
        const h = Math.max(1, Math.abs(y(b.margin) - y0));
        return (
          <rect
            key={b.year}
            x={x(b.year) - barW / 2}
            y={top}
            width={barW}
            height={h}
            fill={b.margin >= 0 ? "var(--party-d)" : "var(--party-r)"}
            className="chart-grow"
            style={{ "--j": i, transformOrigin: b.margin >= 0 ? "bottom" : "top" } as CSSProperties}
          >
            <title>{`${b.year} president in ${stateName}: ${fmtMarginDR(b.margin)}`}</title>
          </rect>
        );
      })}

      <line x1={pad.left} x2={W - pad.right} y1={y0} y2={y0} stroke="var(--ink-faint)" strokeWidth={1.5} />

      {nationPath && model.nation.length > 1 && (
        <path d={nationPath} fill="none" stroke="var(--ink-muted)" strokeWidth={2} strokeLinejoin="miter" className="chart-draw" pathLength={1} />
      )}

      {model.races.map((r) => (
        <rect key={r.year} x={x(r.year) - 5} y={y(r.margin) - 1} width={10} height={2} fill="var(--ink)">
          <title>{`${r.year} ${model.raceLabel} race in ${stateName}: ${fmtMarginDR(r.margin)}`}</title>
        </rect>
      ))}

      {xLabels.map((b) => (
        <text key={b.year} x={x(b.year)} y={H - 8} textAnchor="middle" fontSize={FONT} fill="var(--ink-faint)">
          {dims.short ? shortYear(b.year) : b.year}
        </text>
      ))}

      {ends.map((e, i) => (
        <g key={e.key}>
          <line x1={e.ax + 2} x2={lx - 3} y1={e.ay} y2={placed[i] + 4} stroke="var(--hairline)" strokeWidth={1} />
          <text x={lx} y={placed[i]} fontSize={FONT} fill="var(--ink-muted)">
            {e.name}
          </text>
          <text x={lx} y={placed[i] + 16} fontSize={FONT} fontWeight={700} fill={e.color} className="tnum">
            {e.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Presidential margin in a state, 1976 to 2024, as diverging bars (blue above zero, red below), with the national
 * popular-vote margin as a grey line and the state's past Senate or governor races as short dashes. Labelled at the
 * line ends, one takeaway sentence underneath. Server-rendered SVG; bars grow and the line draws on scroll.
 */
export function MarginHistory({ abbr, stateName, office }: { abbr: string; stateName: string; office?: HistoryOffice }) {
  const model = buildMarginHistory(loadHistory(), abbr, office);
  if (!model) return null;
  const takeaway = historyTakeaway(model, stateName);
  const first = model.bars[0].year;
  const last = model.bars[model.bars.length - 1];
  const label = `${stateName} presidential margin by election, ${first} to ${last.year}, against the national margin. Latest ${fmtMarginDR(last.margin)} in ${last.year}. ${takeaway ?? ""}`.trim();
  return (
    <figure data-reveal className="space-y-3 rounded-lg bg-card p-4 sm:p-6">
      <div className="sm:hidden">
        <Chart model={model} stateName={stateName} dims={COMPACT} label={label} />
      </div>
      <div className="hidden sm:block">
        <Chart model={model} stateName={stateName} dims={WIDE} label={label} />
      </div>
      {takeaway && <figcaption className="text-[15px] leading-snug text-foreground/90">{takeaway}</figcaption>}
    </figure>
  );
}
