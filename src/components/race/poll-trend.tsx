import type { TrendPoint } from "@/data/reference/load";

const W = 640;
const H = 260;
const PAD = { top: 20, right: 132, bottom: 36, left: 40 };
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/**
 * Weekly poll averages as two lines, one per party, labelled at their ends with the candidate and the latest share.
 * Server-rendered SVG: no chart library and no client JavaScript.
 */
export function PollTrend({ points, dName, rName }: { points: TrendPoint[]; dName: string; rName: string }) {
  if (points.length < 2) return null;
  const ts = points.map((p) => Date.parse(p.t));
  const t0 = ts[0];
  const t1 = ts[ts.length - 1];
  const vals = points.flatMap((p) => [p.d, p.r]);
  const lo = Math.floor(Math.min(...vals) - 2);
  const hi = Math.ceil(Math.max(...vals) + 2);
  const x = (t: number) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = (k: "d" | "r") => points.map((p, i) => `${i ? "L" : "M"}${x(ts[i]).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");

  const step = hi - lo > 12 ? 5 : hi - lo > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);

  // One label per month, at the first weekly point in it.
  const months: { t: number; label: string }[] = [];
  for (const t of ts) {
    const label = monthFmt.format(t);
    if (!months.length || months[months.length - 1].label !== label) months.push({ t, label });
  }
  // Keep labels at least ~44px apart so neighbouring months never collide.
  const shownMonths: typeof months = [];
  for (const m of months) if (!shownMonths.length || x(m.t) - x(shownMonths[shownMonths.length - 1].t) >= 44) shownMonths.push(m);

  const last = points[points.length - 1];
  let yd = y(last.d);
  let yr = y(last.r);
  if (Math.abs(yd - yr) < 20) {
    const mid = (yd + yr) / 2;
    const up = last.d >= last.r;
    yd = mid + (up ? -10 : 10);
    yr = mid + (up ? 10 : -10);
  }
  const xEnd = x(t1);
  const surname = (n: string) => n.split(" ").filter((p) => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p)).pop() ?? n;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Weekly poll average: ${dName} ${last.d.toFixed(1)}%, ${rName} ${last.r.toFixed(1)}% in the latest week`}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={PAD.left - 10} y={y(v)} dy="0.35em" textAnchor="end" fontSize={13} fill="var(--ink-faint)">
            {v}
          </text>
        </g>
      ))}
      {shownMonths.map((m) => (
        <text key={m.t} x={x(m.t)} y={H - 10} textAnchor="middle" fontSize={13} fill="var(--ink-faint)">
          {m.label}
        </text>
      ))}
      <path d={path("d")} fill="none" stroke="var(--party-d)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("r")} fill="none" stroke="var(--party-r)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xEnd} cy={y(last.d)} r={4.5} fill="var(--party-d)" />
      <circle cx={xEnd} cy={y(last.r)} r={4.5} fill="var(--party-r)" />
      <text x={xEnd + 12} y={yd} dy="0.35em" fontSize={15} fontWeight={700} fill="var(--party-d-ink)">
        {surname(dName)} {last.d.toFixed(1)}
      </text>
      <text x={xEnd + 12} y={yr} dy="0.35em" fontSize={15} fontWeight={700} fill="var(--party-r-ink)">
        {surname(rName)} {last.r.toFixed(1)}
      </text>
    </svg>
  );
}
