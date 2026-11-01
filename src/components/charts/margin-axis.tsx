import type { CSSProperties } from "react";
import type { RaceMeta } from "@/data/schema";
import { axisDomain, axisMarks, axisTakeaway, placeMarks } from "./margin-axis-data";
import { ratingFill } from "./rating-color";

const FONT_VALUE = 14;
const FONT_NAME = 13;
const LANE_H = 24;

function Line({ meta, W }: { meta: RaceMeta; W: number }) {
  const marks = axisMarks(meta);
  const dom = axisDomain(marks);
  const padX = 22;
  const xOf = (v: number) => padX + ((Math.max(-dom, Math.min(dom, v)) + dom) / (2 * dom)) * (W - 2 * padX);
  // Left is Democratic, right is Republican, so a positive (D) margin sits left of centre.
  const xD = (v: number) => xOf(-v);
  const placed = placeMarks(marks, xD, W);
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));
  const axisY = lanes * LANE_H + 14;
  const H = axisY + 52;
  const step = dom > 20 ? 20 : 10;
  const ticks: number[] = [];
  for (let t = -dom; t <= dom; t += step) ticks.push(t);
  const colorOf = (v: number) => (v >= 0 ? "var(--party-d)" : "var(--party-r)");
  const inkOf = (v: number) => (v >= 0 ? "var(--party-d-ink)" : "var(--party-r-ink)");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={xD(t)} x2={xD(t)} y1={6} y2={axisY} stroke={t === 0 ? "var(--ink-faint)" : "var(--hairline)"} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={xD(t)} y={axisY + 22} textAnchor="middle" fontSize={FONT_NAME} fill="var(--ink-faint)" className="tnum">
            {Math.abs(t)}
          </text>
        </g>
      ))}
      <text x={padX - 12} y={axisY + 44} fontSize={FONT_NAME} fontWeight={600} fill="var(--party-d-ink)">
        Democratic
      </text>
      <text x={W - padX + 12} y={axisY + 44} textAnchor="end" fontSize={FONT_NAME} fontWeight={600} fill="var(--party-r-ink)">
        Republican
      </text>

      {placed.map((p, i) => {
        const m = p.mark;
        const stemTop = (lanes - 1 - p.lane) * LANE_H + 3; // lane 0 sits nearest the axis
        const band = m.band;
        return (
          <g key={m.key}>
            {band && (
              <rect
                x={Math.min(xD(band[0]), xD(band[1]))}
                y={axisY - 5}
                width={Math.abs(xD(band[1]) - xD(band[0]))}
                height={10}
                fill={ratingFill(m.rating!)}
                className="chart-grow-x"
                style={{ "--j": 0, transformOrigin: p.x < W / 2 ? "right" : "left" } as CSSProperties}
              />
            )}
            <line x1={p.x} x2={p.x} y1={stemTop} y2={axisY + (band ? -5 : 0)} stroke={band ? "var(--ink-muted)" : colorOf(m.value)} strokeWidth={2} className="chart-grow" style={{ "--j": i + 1, transformOrigin: "bottom" } as CSSProperties} />
          </g>
        );
      })}

      {placed.map((p) => {
        const m = p.mark;
        const top = (lanes - 1 - p.lane) * LANE_H;
        const band = m.band;
        return (
          <text key={m.key} x={p.tx} y={top + 16} textAnchor={p.anchor} fontSize={FONT_NAME} fill="var(--ink-muted)" stroke="var(--card)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
            <tspan fontSize={FONT_VALUE} fontWeight={700} fill={band ? "var(--ink)" : inkOf(m.value)} className="tnum">
              {m.text}
            </tspan>
            <tspan dx={8}>{m.name}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

/**
 * One number line from Democratic (left) to Republican (right) with the race's marks on it: the forecast rating as a
 * band on the axis, the poll average, the last race for this office and the 2024 and 2020 presidential margins. Each
 * mark is labelled with its value and name. Needs at least two marks. Server-rendered SVG.
 */
export function MarginAxis({ meta }: { meta: RaceMeta }) {
  const marks = axisMarks(meta);
  if (marks.length < 2) return null;
  const takeaway = axisTakeaway(marks);
  const summary = `Margins for this race, Democratic to Republican: ${marks.map((m) => `${m.name} ${m.text}`).join(", ")}.`;
  return (
    <figure data-reveal className="space-y-3 rounded-lg bg-card p-4 sm:p-6">
      <h3 className="text-[15px] font-semibold text-ink-muted">Where the race sits, in points</h3>
      <div role="img" aria-label={`${summary} ${takeaway ?? ""}`.trim()}>
        <div className="sm:hidden">
          <Line meta={meta} W={300} />
        </div>
        <div className="hidden sm:block">
          <Line meta={meta} W={640} />
        </div>
      </div>
      {takeaway && <figcaption className="text-[15px] leading-snug text-foreground/90">{takeaway}</figcaption>}
    </figure>
  );
}
