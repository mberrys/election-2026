"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useHistory } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import type { BalanceOfPower } from "@/data/schema";
import { seatTotals } from "./balance";

const config = {
  d: { label: "Dem + Ind", color: "var(--party-d)" },
  r: { label: "GOP", color: "var(--party-r)" },
} satisfies ChartConfig;

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/**
 * D vs R seats (not up + won + leaning) over the night, from the balance-of-power history.
 * Renders nothing until there are two snapshots to draw: no empty frame before counting.
 * No legend: the lines are in the party colours and the tooltip names them.
 */
export function SeatSparkline({ office = "senate", majority = 51 }: { office?: "senate" | "house" | "governor"; majority?: number }) {
  const mounted = useMounted();
  const { data } = useHistory();

  const points = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows
      .filter((r) => r.balance?.[office])
      .map((r) => {
        const bop: BalanceOfPower = r.balance[office];
        const t = seatTotals(bop);
        return { t: new Date(r.generatedAt).getTime(), d: t.d, r: t.r };
      });
  }, [data, office]);

  if (!mounted || points.length < 2) return null;

  const ys = points.flatMap((p) => [p.d, p.r]);
  const lo = Math.min(...ys, majority) - 2;
  const hi = Math.max(...ys, majority) + 2;

  return (
    <figure>
      <figcaption className="mb-2 text-[15px] font-semibold">Seats through the night</figcaption>
      <ChartContainer config={config} className="aspect-auto h-28 w-full" initialDimension={{ width: 320, height: 112 }}>
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => timeFmt.format(v)} tickLine={false} axisLine={false} minTickGap={48} fontSize={12} />
          <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} width={30} fontSize={12} allowDecimals={false} />
          <ReferenceLine
            y={majority}
            stroke="var(--foreground)"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
            label={{ value: String(majority), position: "insideTopRight", fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(_, payload) => (payload?.[0]?.payload?.t ? timeFmt.format(payload[0].payload.t) + " ET" : "")} />}
          />
          <Line type="stepAfter" dataKey="d" stroke="var(--color-d)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="r" stroke="var(--color-r)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}
