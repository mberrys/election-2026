"use client";

import { useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { BalanceBar } from "./balance-bar";
import type { BalanceOfPower } from "@/data/schema";

/** Compact Senate + House bars in the header. Shows seat totals (not-up + called + leaning). */
export function HeaderBalance() {
  const mounted = useMounted();
  const { data } = useNational();
  if (!mounted || !data?.balance || !data.races.length) return null;
  return (
    <div className="flex items-center gap-5">
      <Mini label="Senate" bop={data.balance.senate} />
      <Mini label="House" bop={data.balance.house} />
    </div>
  );
}

function Mini({ label, bop }: { label: string; bop: BalanceOfPower }) {
  const d = bop.notUp.D + bop.notUp.I + bop.called.D + bop.called.I;
  const r = bop.notUp.R + bop.called.R;
  return (
    <div className="w-44">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs leading-none">
        <span className="fig font-semibold text-party-d-ink">{d}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="fig font-semibold text-party-r-ink">{r}</span>
      </div>
      <BalanceBar bop={bop} height={5} showMajorityTick={false} />
    </div>
  );
}
