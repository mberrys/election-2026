"use client";

import { useMemo } from "react";
import { rankBellwethers } from "@/analytics";
import { Card } from "@/components/ui/card";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fmtOU, ouColor } from "./county-map-panel";
import type { CountyRow } from "./derive";

/**
 * Eight counties whose 2020/2024 lean tracked the statewide result most closely. Live "over/under" compares the
 * county's current margin to (statewide margin now + its historical lean): positive means the county is running
 * ahead of where it "should" be for D given the statewide picture.
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
    return <p className={cn("text-sm text-muted-foreground", className)}>No county baselines for this state yet — bellwethers appear once 2020/2024 county results are loaded.</p>;

  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {ranked.map((b, i) => {
        const r = byId.get(b.id);
        const expectedNow = stateMarginNow != null ? stateMarginNow + b.lean : undefined;
        const ou = r?.margin != null && expectedNow != null ? r.margin - expectedNow : undefined;
        const pctIn = r?.pctIn;
        return (
          <li key={b.id}>
            <Card
              role="button"
              tabIndex={0}
              onClick={() => onSelect(selected === b.id ? null : b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(selected === b.id ? null : b.id);
                }
              }}
              className={cn("cursor-pointer gap-1.5 p-3 transition-colors hover:border-foreground/20", selected === b.id && "border-foreground/40 bg-accent/40")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  <span className="mr-1.5 text-[10px] text-muted-foreground tnum">#{i + 1}</span>
                  {b.name ?? r?.name ?? b.id}
                </span>
                <span className="text-[11px] tnum text-muted-foreground">{pctIn != null ? `${Math.round(pctIn * 100)}% in` : "—"}</span>
              </div>
              <dl className="grid grid-cols-3 gap-1 text-[11px]">
                <div>
                  <dt className="text-muted-foreground" title="Historical lean relative to the statewide margin">
                    Lean
                  </dt>
                  <dd className={cn("tnum font-medium", b.lean > 0.05 ? "text-party-d-ink" : b.lean < -0.05 ? "text-party-r-ink" : "")} title={`Mean of ${b.baselines} baseline${b.baselines === 1 ? "" : "s"}; |lean| ${b.absLean.toFixed(1)}`}>
                    {fmtMarginDR(b.lean)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Now</dt>
                  <dd className="tnum font-medium">{fmtMarginDR(r?.margin)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">vs lean</dt>
                  <dd className={cn("tnum font-medium", ouColor(ou))} title={expectedNow != null ? `Expected ${fmtMarginDR(expectedNow)} given statewide ${fmtMarginDR(stateMarginNow)}` : undefined}>
                    {fmtOU(ou)}
                  </dd>
                </div>
              </dl>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
