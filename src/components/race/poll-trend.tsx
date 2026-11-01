import type { TrendPoint } from "@/data/reference/load";
import { niceScale, spreadLabels } from "@/components/charts/scale";

interface Dims {
  W: number;
  H: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const COMPACT: Dims = { W: 300, H: 230, pad: { top: 16, right: 84, bottom: 30, left: 30 } };
const WIDE: Dims = { W: 640, H: 260, pad: { top: 18, right: 112, bottom: 32, left: 36 } };
const FONT = 13;
const surname = (n: string) => n.split(" ").filter((p) => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p)).pop() ?? n;

function Chart({ points, dName, rName, dims, label }: { points: TrendPoint[]; dName: string; rName: string; dims: Dims; label: string }) {
  const { W, H, pad } = dims;
  const ts = points.map((p) => Date.parse(p.t));
  const t0 = ts[0];
  const t1 = ts[ts.length - 1];
  const vals = points.flatMap((p) => [p.d, p.r]);
  const scale = niceScale(Math.min(...vals), Math.max(...vals));
  const x = (t: number) => pad.left + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * (H - pad.top - pad.bottom);
  const path = (k: "d" | "r") => points.map((p, i) => `${i ? "L" : "M"}${x(ts[i]).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");

  // Month labels at the first weekly point in each month, at least 44px apart; four to eight of them.
  const months: { t: number; label: string }[] = [];
  for (const t of ts) {
    const m = monthFmt.format(t);
    if (!months.length || months[months.length - 1].label !== m) months.push({ t, label: m });
  }
  const shown: typeof months = [];
  for (const m of months) if (!shown.length || x(m.t) - x(shown[shown.length - 1].t) >= 46) shown.push(m);

  const last = points[points.length - 1];
  const xEnd = x(t1);
  const [yd, yr] = spreadLabels([y(last.d), y(last.r)], 36, pad.top + 12, H - pad.bottom - 24);
  const lx = xEnd + 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {scale.ticks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="var(--hairline)" strokeWidth={1} />
          <text x={pad.left - 8} y={y(v)} dy="0.35em" textAnchor="end" fontSize={FONT} fill="var(--ink-faint)" className="tnum">
            {v}
          </text>
        </g>
      ))}
      {shown.map((m) => (
        <text key={m.t} x={x(m.t)} y={H - 8} textAnchor="middle" fontSize={FONT} fill="var(--ink-faint)">
          {m.label}
        </text>
      ))}
      <path d={path("d")} fill="none" stroke="var(--party-d)" strokeWidth={2} strokeLinejoin="miter" className="chart-draw" pathLength={1} />
      <path d={path("r")} fill="none" stroke="var(--party-r)" strokeWidth={2} strokeLinejoin="miter" className="chart-draw" pathLength={1} />
      <circle cx={xEnd} cy={y(last.d)} r={3.5} fill="var(--party-d)" />
      <circle cx={xEnd} cy={y(last.r)} r={3.5} fill="var(--party-r)" />
      <text x={lx} y={yd} fontSize={FONT} fill="var(--ink-muted)">
        {surname(dName)}
      </text>
      <text x={lx} y={yd + 17} fontSize={15} fontWeight={700} fill="var(--party-d-ink)" className="tnum">
        {last.d.toFixed(1)}
      </text>
      <text x={lx} y={yr} fontSize={FONT} fill="var(--ink-muted)">
        {surname(rName)}
      </text>
      <text x={lx} y={yr + 17} fontSize={15} fontWeight={700} fill="var(--party-r-ink)" className="tnum">
        {last.r.toFixed(1)}
      </text>
    </svg>
  );
}

/**
 * Weekly poll averages as two straight 2px lines, one per party, labelled at their ends with the candidate and the
 * latest share. Server-rendered SVG, no chart library and no client JavaScript; the lines draw in when the wrapper
 * carrying `data-reveal` scrolls into view. Separate phone and wide drawings keep the text at 12px or more.
 */
export function PollTrend({ points, dName, rName }: { points: TrendPoint[]; dName: string; rName: string }) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const label = `Weekly poll average: ${dName} ${last.d.toFixed(1)}%, ${rName} ${last.r.toFixed(1)}% in the latest week`;
  return (
    <>
      <div className="sm:hidden">
        <Chart points={points} dName={dName} rName={rName} dims={COMPACT} label={label} />
      </div>
      <div className="hidden sm:block">
        <Chart points={points} dName={dName} rName={rName} dims={WIDE} label={label} />
      </div>
    </>
  );
}
