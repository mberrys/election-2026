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

/** Animated number (odometer roll) with tabular digits. Falls back to "—" for missing values. */
export function Num({ value, format, prefix, suffix, className, trend = 0 }: Props) {
  if (value == null || Number.isNaN(value)) return <span className={cn("tnum text-muted-foreground", className)}>—</span>;
  return (
    <NumberFlow
      value={value}
      format={format}
      prefix={prefix}
      suffix={suffix}
      trend={trend}
      className={cn("tnum", className)}
      willChange
    />
  );
}

export const Pct = ({ value, digits = 1, className }: { value: number | null | undefined; digits?: number; className?: string }) => (
  <Num value={value} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} suffix="%" className={className} />
);

export const Votes = ({ value, className }: { value: number | null | undefined; className?: string }) => (
  <Num value={value} format={{ maximumFractionDigits: 0 }} className={className} />
);

/** "D+4.2" / "R+1.0" with animated magnitude. */
export function MarginDR({ value, digits = 1, className }: { value: number | null | undefined; digits?: number; className?: string }) {
  if (value == null || Number.isNaN(value)) return <span className={cn("tnum text-muted-foreground", className)}>—</span>;
  const lead = Math.abs(value) < 0.05 ? null : value > 0 ? "D" : "R";
  return (
    <span className={cn("tnum", lead === "D" && "text-party-d", lead === "R" && "text-party-r", className)}>
      {lead ? `${lead}+` : "Even "}
      {lead && <Num value={Math.abs(value)} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} />}
    </span>
  );
}

export { NumberFlowGroup };
