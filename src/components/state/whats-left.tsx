"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { compact, fmtMarginDR, nf0 } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountyRow } from "./derive";

const marginInk = (m: number | undefined) => (m == null ? "text-muted-foreground" : m > 0 ? "text-party-d-ink" : m < 0 ? "text-party-r-ink" : "text-muted-foreground");

/**
 * Top-N counties by estimated remaining vote. Before the count: where the vote is (estimated size and 2024 margin,
 * plain bars). During the count: counted vs outstanding (hatched) with the benchmark lean of what is left.
 */
export function WhatsLeft({
  rows,
  n = 12,
  hasVotes,
  selected,
  onSelect,
  className,
}: {
  rows: CountyRow[];
  n?: number;
  /** Any county has counted votes. */
  hasVotes: boolean;
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

  if (!top.length)
    return <p className={cn("text-[15px] text-muted-foreground", className)}>Nothing left to count{rows.length ? ": every county is fully reported." : "."}</p>;

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm text-muted-foreground">
        {hasVotes ? (
          <>
            About <span className="font-semibold text-foreground tnum">{compact.format(Math.round(totalRemaining))}</span> votes left statewide. Bars show
            counted (solid) against outstanding (hatched); lean is the benchmark for what remains.
          </>
        ) : (
          <>
            About <span className="font-semibold text-foreground tnum">{compact.format(Math.round(totalRemaining))}</span> votes expected statewide
            (2024 turnout × midterm ratio). Largest counties, with their 2024 presidential margin.
          </>
        )}
      </p>
      <ul className="space-y-0.5">
        {top.map((r) => {
          const key = r.fips ?? r.id;
          const expected = r.expected ?? r.votesIn + (r.remaining ?? 0);
          const widthPct = (expected / max) * 100;
          const countedPct = expected > 0 ? (r.votesIn / expected) * 100 : 0;
          const leadParty = r.margin == null ? null : r.margin > 0 ? "D" : r.margin < 0 ? "R" : null;
          const lean = hasVotes ? r.benchmark : r.margin2024;
          return (
            <motion.li
              key={key}
              layout="position"
              initial={false}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              onClick={() => onSelect(selected === key ? null : key)}
              className={cn(
                "grid cursor-pointer grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-x-3 rounded px-1.5 py-1 text-sm hover:bg-muted/40",
                selected === key && "bg-accent/60",
              )}
            >
              <span className="truncate font-medium" title={r.name}>
                {r.name.replace(/ County$/, "")}
              </span>
              <span
                className="relative h-3 w-full"
                title={
                  hasVotes
                    ? `${nf0.format(r.votesIn)} counted · ≈${nf0.format(Math.round(r.remaining ?? 0))} remaining of ${nf0.format(Math.round(expected))}`
                    : `≈${nf0.format(Math.round(expected))} votes expected`
                }
              >
                {hasVotes ? (
                  <span className="absolute inset-y-0 left-0 flex overflow-hidden rounded-sm bg-s3" style={{ width: `${widthPct}%` }}>
                    <span
                      className={cn("h-full transition-[width] duration-700", leadParty === "D" ? "bg-party-d" : leadParty === "R" ? "bg-party-r" : "bg-foreground/50")}
                      style={{ width: `${countedPct}%` }}
                    />
                    <span
                      className="h-full flex-1"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in oklch, var(--foreground) 18%, transparent) 3px 4px)", // taste-skill-ignore: hatch marks the not-yet-counted share
                      }}
                    />
                  </span>
                ) : (
                  <span className="absolute inset-y-0 left-0 rounded-sm bg-muted-foreground/35" style={{ width: `${widthPct}%` }} />
                )}
              </span>
              <span className="flex items-baseline gap-3 whitespace-nowrap tnum">
                <span className="w-14 text-right font-semibold">{compact.format(Math.round(r.remaining ?? 0))}</span>
                <span className={cn("w-14 text-right text-xs", marginInk(lean))} title={hasVotes ? "Benchmark lean of the remaining vote" : "2024 presidential margin"}>
                  {lean == null ? null : Math.abs(lean) < 0.5 ? "Even" : fmtMarginDR(lean, 0)}
                </span>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
