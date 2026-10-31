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

/** D vs R seats (not up + won + leaning) over the night, from the balance-of-power history. */
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

  if (!mounted || points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border/60 text-[11px] text-muted-foreground">
        Seat history draws here once counting begins
      </div>
    );
  }

  const ys = points.flatMap((p) => [p.d, p.r]);
  const lo = Math.min(...ys, majority) - 2;
  const hi = Math.max(...ys, majority) + 2;

  return (
    <ChartContainer config={config} className="aspect-auto h-24 w-full" initialDimension={{ width: 320, height: 96 }}>
      <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => timeFmt.format(v)} tickLine={false} axisLine={false} minTickGap={48} fontSize={10} />
        <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} width={40} fontSize={10} allowDecimals={false} />
        <ReferenceLine y={majority} stroke="var(--foreground)" strokeOpacity={0.5} strokeDasharray="3 3" />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, payload) => (payload?.[0]?.payload?.t ? timeFmt.format(payload[0].payload.t) + " ET" : "")} />}
        />
        <Line type="stepAfter" dataKey="d" stroke="var(--color-d)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="r" stroke="var(--color-r)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}
