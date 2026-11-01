"use client";

import { useMemo } from "react";
import { rankBellwethers } from "@/analytics";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fmtOU, ouColor } from "./county-map-panel";
import type { CountyRow } from "./derive";

const leanInk = (v: number) => (v > 0.05 ? "text-party-d-ink" : v < -0.05 ? "text-party-r-ink" : "text-foreground");

/**
 * Eight counties whose 2020/2024 lean tracked the statewide result most closely. Live "vs lean" compares the
 * county's current margin to (statewide margin now + its historical lean): positive means the county is running
 * ahead of where it "should" be for D given the statewide picture. Before votes, each shows only its lean.
 */
export function Bellwethers({
  rows,
  stateBaseline,
  stateMarginNow,
  selected,
  onSelect,
  n = 8,
  className,
}: {
  rows: CountyRow[];
  stateBaseline: { margin2024?: number; margin2020?: number };
  stateMarginNow?: number;
  selected: string | null;
  onSelect: (fips: string | null) => void;
  n?: number;
  className?: string;
}) {
  const byId = useMemo(() => new Map(rows.map((r) => [r.fips ?? r.id, r])), [rows]);
  const ranked = useMemo(
    () =>
      rankBellwethers(
        rows.map((r) => ({ id: r.fips ?? r.id, name: r.name, margin2024: r.margin2024, margin2020: r.margin2020 })),
        stateBaseline,
        n,
      ),
    [rows, stateBaseline, n],
  );

  if (!ranked.length)
    return <p className={cn("text-[15px] text-muted-foreground", className)}>Bellwethers appear once 2020 and 2024 county results load for this state.</p>;

  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {ranked.map((b) => {
        const r = byId.get(b.id);
        const counted = r?.live && r.votesIn > 0;
        const expectedNow = stateMarginNow != null ? stateMarginNow + b.lean : undefined;
        const ou = counted && r?.margin != null && expectedNow != null ? r.margin - expectedNow : undefined;
        const isSel = selected === b.id;
        return (
          <li key={b.id}>
            <button
              type="button"
              aria-pressed={isSel}
              onClick={() => onSelect(isSel ? null : b.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg border border-border px-3.5 py-2.5 text-left transition-colors hover:bg-s3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isSel && "border-foreground/40 bg-accent/40",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-semibold">{(b.name ?? r?.name ?? b.id).replace(/ County$/, "")}</span>
                {counted && r?.pctIn != null && <span className="shrink-0 text-xs text-muted-foreground tnum">{Math.round(r.pctIn * 100)}% in</span>}
              </span>
              <span className="text-xs text-muted-foreground tnum" title={`Mean of ${b.baselines} baseline${b.baselines === 1 ? "" : "s"}`}>
                Runs <span className={cn("font-medium", leanInk(b.lean))}>{fmtMarginDR(b.lean)}</span> vs the state
                {counted && r?.margin != null && (
                  <>
                    {" · now "}
                    <span className={cn("font-medium", leanInk(r.margin))}>{fmtMarginDR(r.margin)}</span>
                  </>
                )}
                {ou != null && (
                  <>
                    {" · "}
                    <span
                      className={cn("font-medium", ouColor(ou))}
                      title={expectedNow != null ? `Expected ${fmtMarginDR(expectedNow)} given statewide ${fmtMarginDR(stateMarginNow)}` : undefined}
                    >
                      {fmtOU(ou)}
                    </span>{" "}
                    vs lean
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
