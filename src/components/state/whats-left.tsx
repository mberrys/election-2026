"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { compact, fmtMarginDR, nf0 } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountyRow } from "./derive";

/**
 * Top-N counties by estimated remaining vote: stacked counted/remaining bar, remaining count and benchmark lean,
 * so the viewer sees where the outstanding vote is and which way it should break.
 */
export function WhatsLeft({
  rows,
  n = 12,
  selected,
  onSelect,
  className,
}: {
  rows: CountyRow[];
  n?: number;
  selected: string | null;
  onSelect: (fips: string | null) => void;
  className?: string;
}) {
  const top = useMemo(
    () =>
      rows
        .filter((r) => (r.remaining ?? 0) > 0)
        .sort((a, b) => (b.remaining ?? 0) - (a.remaining ?? 0))
        .slice(0, n),
    [rows, n],
  );
  const max = top[0]?.expected ?? 1;
  const totalRemaining = useMemo(() => rows.reduce((s, r) => s + (r.remaining ?? 0), 0), [rows]);
  const allPre = rows.every((r) => !r.live);

  if (!top.length)
    return <p className={cn("text-sm text-muted-foreground", className)}>Nothing left to count{rows.length ? " — every county is fully reported." : "."}</p>;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>
          {allPre ? "Estimated vote by county (2024 turnout × midterm ratio)" : "Largest outstanding counties"} · bar = counted vs est. remaining
        </span>
        <span className="tnum">≈ {compact.format(Math.round(totalRemaining))} statewide remaining</span>
      </div>
      <ul className="space-y-1">
        {top.map((r) => {
          const key = r.fips ?? r.id;
          const expected = r.expected ?? r.votesIn + (r.remaining ?? 0);
          const widthPct = (expected / max) * 100;
          const countedPct = expected > 0 ? (r.votesIn / expected) * 100 : 0;
          const leadParty = r.margin == null ? null : r.margin > 0 ? "D" : r.margin < 0 ? "R" : null;
          const bench = r.benchmark;
          return (
            <motion.li
              key={key}
              layout="position"
              initial={false}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              onClick={() => onSelect(selected === key ? null : key)}
              className={cn(
                "grid cursor-pointer grid-cols-[8.5rem_1fr_auto] items-center gap-x-3 rounded px-1 py-0.5 text-xs hover:bg-muted/40",
                selected === key && "bg-accent/60",
              )}
            >
              <span className="truncate font-medium" title={r.name}>
                {r.name}
              </span>
              <span className="relative h-3.5 w-full" title={`${nf0.format(r.votesIn)} counted · ≈${nf0.format(Math.round(r.remaining ?? 0))} remaining of ${nf0.format(Math.round(expected))}`}>
                <span className="absolute inset-y-0 left-0 flex overflow-hidden rounded-sm bg-uncalled/25" style={{ width: `${widthPct}%` }}>
                  <span
                    className={cn("h-full transition-[width] duration-700", leadParty === "D" ? "bg-party-d" : leadParty === "R" ? "bg-party-r" : "bg-foreground/50")}
                    style={{ width: `${countedPct}%` }}
                  />
                  <span
                    className="h-full flex-1"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in oklch, var(--foreground) 18%, transparent) 3px 4px)",
                    }}
                  />
                </span>
              </span>
              <span className="flex items-baseline gap-2 tnum whitespace-nowrap">
                <span className="w-14 text-right font-semibold">{compact.format(Math.round(r.remaining ?? 0))}</span>
                <span className={cn("w-16 text-right text-[11px]", bench != null && (bench > 0 ? "text-party-d" : bench < 0 ? "text-party-r" : "text-muted-foreground"))} title="Benchmark lean of the remaining vote">
                  {bench != null ? `lean ${fmtMarginDR(bench, 0)}` : "—"}
                </span>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
