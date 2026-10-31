"use client";

import NumberFlow, { NumberFlowGroup, type Format } from "@number-flow/react";
import { cn } from "@/lib/utils";

type Props = {
  value: number | null | undefined;
  format?: Format;
  prefix?: string;
  suffix?: string;
  className?: string;
  trend?: number;
};

/** Animated number (odometer roll, 600ms) with tabular digits. Falls back to "—" for missing values. */
export function Num({ value, format, prefix, suffix, className, trend = 0 }: Props) {
  if (value == null || Number.isNaN(value)) return <span className={cn("tnum text-muted-foreground", className)}>—</span>;
  return (
    <NumberFlow
      value={value}
      format={format}
      prefix={prefix}
      suffix={suffix}
      trend={trend}
      transformTiming={{ duration: 600, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      spinTiming={{ duration: 600, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      className={cn("tnum", className)}
      willChange
    />
  );
}

/** Shares and vote counts tick, so they set in JetBrains Mono (`fig`). */
export const Pct = ({ value, digits = 1, className }: { value: number | null | undefined; digits?: number; className?: string }) => (
  <Num value={value} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} suffix="%" className={cn("fig", className)} />
);

export const Votes = ({ value, className }: { value: number | null | undefined; className?: string }) => (
  <Num value={value} format={{ maximumFractionDigits: 0 }} className={cn("fig", className)} />
);

/** "D+4.2" / "R+1.0" with animated magnitude. */
export function MarginDR({ value, digits = 1, className }: { value: number | null | undefined; digits?: number; className?: string }) {
  if (value == null || Number.isNaN(value)) return <span className={cn("tnum text-muted-foreground", className)}>—</span>;
  const lead = Math.abs(value) < 0.05 ? null : value > 0 ? "D" : "R";
  return (
    <span className={cn("fig", lead === "D" && "text-party-d-ink", lead === "R" && "text-party-r-ink", className)}>
      {lead ? `${lead}+` : "Even "}
      {lead && <Num value={Math.abs(value)} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} />}
    </span>
  );
}

export { NumberFlowGroup };
