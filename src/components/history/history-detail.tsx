"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { rampColor } from "@/components/board/hatch";
import { useMounted } from "@/hooks/use-mounted";
import type { HistoryRowModel } from "@/analytics/history";
import type { TrendPoint } from "@/data/reference/load";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { YARDSTICK_LABEL, lastTimeSentence } from "./summary";

const lineConfig = { margin: { label: "Poll margin (D−R)", color: "var(--foreground)" } } satisfies ChartConfig;
const barConfig = { margin: { label: "Margin (D−R)", color: "var(--party-d)" } } satisfies ChartConfig;

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

interface Props {
  row: HistoryRowModel;
  yardstick: string;
  trend?: TrendPoint[];
  className?: string;
}

export function HistoryDetail({ row, yardstick, trend, className }: Props) {
  const mounted = useMounted();
  const p = row.projection;

  const trendData = useMemo(() => (trend ?? []).map((t) => ({ t: Date.parse(t.t), margin: Math.round((t.d - t.r) * 10) / 10 })), [trend]);

  const barData = useMemo(() => {
    const past = Object.entries(row.series)
      .map(([y, m]) => ({ year: y, margin: m, projected: false }))
      .sort((a, b) => Number(a.year) - Number(b.year));
    return p ? [...past, { year: "2026", margin: Math.round(p.margin * 10) / 10, projected: true }] : past;
  }, [row.series, p]);

  const swing = row.change;

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="display text-[18px] font-semibold leading-tight">{row.label}</h3>
        <p className="mt-1 text-[15px] leading-relaxed">{lastTimeSentence(row, yardstick)}</p>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-[13px]">
        {p && <Stat label="Projected" value={fmtMarginDR(p.margin)} />}
        {row.latestMargin !== undefined && (
          <Stat label={row.latestYear ? `${row.latestYear} ${YARDSTICK_LABEL[yardstick] ?? ""}`.trim() : "Latest"} value={fmtMarginDR(row.latestMargin)} />
        )}
        {swing !== undefined && <Stat label="Change" value={`${swing >= 0 ? "+" : "−"}${Math.abs(swing).toFixed(1)} pts`} hint={swing >= 0 ? "toward D" : "toward R"} />}
      </dl>

      <p className="text-[13px] leading-snug text-muted-foreground">
        {row.kind === "nation" && p
          ? "Generic-ballot average, as published, set against the presidential popular vote."
          : p?.source === "poll" && p.poll
            ? `Latest poll average: D ${p.poll.d.toFixed(1)} / R ${p.poll.r.toFixed(1)} · ${p.poll.n} polls · as of ${p.poll.asOf} · ${p.poll.pollster}. Shown as published, with no adjustment for past poll error.`
            : p
              ? "No race poll. Projected from the last presidential margin plus the national swing since then (generic ballot)."
              : null}
        {row.closest && row.closest !== row.lastTime ? ` Closest match by margin: ${row.closest} (${fmtMarginDR(row.series[String(row.closest)])}).` : ""}
      </p>

      {row.caveat && (
        <p className="text-[13px] leading-snug text-muted-foreground" role="note">
          {row.caveat === "redrawn-2026"
            ? "Redrawn for 2026: House results are on the old lines; presidential margins are on the new lines."
            : "Redrawn for 2024: only results on the current lines are shown."}
        </p>
      )}

      <section aria-label="Polling since January" className="space-y-1">
        <h4 className="text-[13px] font-semibold text-muted-foreground">Polling since January</h4>
        {mounted && trendData.length >= 2 ? (
          <ChartContainer config={lineConfig} className="aspect-auto h-32 w-full" initialDimension={{ width: 320, height: 128 }}>
            <LineChart data={trendData} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => monthFmt.format(v)} tickLine={false} axisLine={false} minTickGap={32} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} tickFormatter={(v: number) => fmtMarginDR(v, 0)} domain={["auto", "auto"]} />
              <ReferenceLine y={0} stroke="var(--foreground)" strokeOpacity={0.4} />
              {row.latestMargin !== undefined && (
                <ReferenceLine
                  y={row.latestMargin}
                  stroke="var(--foreground)"
                  strokeOpacity={0.6}
                  strokeDasharray="4 3"
                  label={{ value: `${row.latestYear}`, position: "insideTopRight", fontSize: 12, fill: "var(--muted-foreground)" }}
                />
              )}
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, pl) => (pl?.[0]?.payload?.t ? `Week of ${dateFmt.format(pl[0].payload.t)}` : "")} formatter={(v) => fmtMarginDR(Number(v))} />} />
              <Line type="monotone" dataKey="margin" stroke="var(--color-margin)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-[13px] text-muted-foreground">Not enough polls this year to draw a trend.</p>
        )}
      </section>

      <section aria-label="Past elections" className="space-y-1">
        <h4 className="text-[13px] font-semibold text-muted-foreground">Past elections and the 2026 projection</h4>
        {mounted && barData.length >= 2 ? (
          <ChartContainer config={barConfig} className="aspect-auto h-36 w-full" initialDimension={{ width: 320, height: 144 }}>
            <BarChart data={barData} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={12} minTickGap={10} tickFormatter={(y: string) => (barData.length > 14 ? `’${y.slice(2)}` : y)} />
              <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} tickFormatter={(v: number) => fmtMarginDR(v, 0)} />
              <ReferenceLine y={0} stroke="var(--foreground)" strokeOpacity={0.5} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtMarginDR(Number(v))} labelFormatter={(l) => (l === "2026" ? "2026 projected" : String(l))} />} />
              <Bar dataKey="margin" isAnimationActive={false} radius={1}>
                {barData.map((b) => (
                  <Cell
                    key={b.year}
                    fill={rampColor(b.margin)}
                    fillOpacity={b.projected ? 0.45 : 1}
                    stroke={b.projected ? "var(--foreground)" : b.year === String(row.lastTime) ? "var(--foreground)" : "none"}
                    strokeDasharray={b.projected ? "3 2" : undefined}
                    strokeWidth={b.projected || b.year === String(row.lastTime) ? 1.5 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-[13px] text-muted-foreground">No history for this unit.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tnum text-[15px] font-semibold">
        {value}
        {hint && <span className="ml-1 text-[13px] font-normal text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}
