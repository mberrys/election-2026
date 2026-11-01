"use client";

import { useMemo } from "react";
import { rampColor } from "@/components/board/hatch";
import type { HistoryRowModel } from "@/analytics/history";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  rows: HistoryRowModel[];
  /** Pinned above the list regardless of sort (the national row). */
  pinned?: HistoryRowModel;
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Noun for the unit column header. */
  unitLabel: string;
}

const ROW_COLS = "grid grid-cols-[6.5rem_minmax(11rem,1fr)_3.25rem_5.5rem] items-center gap-x-2 sm:grid-cols-[9rem_minmax(14rem,1fr)_3.75rem_6.5rem]";

/**
 * One row per unit; one narrow cell per past election coloured on the margin ramp, then a hatched cell for the
 * 2026 projection. The cell for the "last time" election is outlined so the answer is visible in the row itself.
 */
export function HistoryStrips({ rows, pinned, selectedId, onSelect, unitLabel }: Props) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of [...(pinned ? [pinned] : []), ...rows]) for (const y of Object.keys(r.series)) set.add(Number(y));
    return [...set].sort((a, b) => a - b);
  }, [rows, pinned]);

  const labelEvery = years.length > 24 ? 4 : years.length > 14 ? 2 : 1;

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card" role="group" aria-label={`${unitLabel} election history`}>
      <div className="min-w-[34rem]">
        <div className={cn(ROW_COLS, "sticky top-0 z-10 border-b border-border bg-card px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground")}>
          <span>{unitLabel}</span>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }} aria-hidden>
            {years.map((y, i) => (
              <span key={y} className="overflow-visible whitespace-nowrap text-center text-[10px] font-normal normal-case tracking-normal">
                {i % labelEvery === 0 || i === years.length - 1 ? `’${String(y).slice(2)}` : ""}
              </span>
            ))}
          </div>
          <span className="text-right">2026</span>
          <span className="text-right">Last this way</span>
        </div>
        <ul className="divide-y divide-border/60">
          {pinned && (
            <li className="bg-muted/30">
              <Row row={pinned} years={years} selected={selectedId === pinned.id} onSelect={onSelect} />
            </li>
          )}
          {rows.map((r) => (
            <li key={r.id}>
              <Row row={r} years={years} selected={selectedId === r.id} onSelect={onSelect} />
            </li>
          ))}
          {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}

/** "1976–2024": the years this row has data for. */
function span(row: HistoryRowModel): string {
  const ys = Object.keys(row.series).map(Number);
  return `${Math.min(...ys)}–${Math.max(...ys)}`;
}

function Row({ row, years, selected, onSelect }: { row: HistoryRowModel; years: number[]; selected: boolean; onSelect: (id: string) => void }) {
  const p = row.projection;
  const summary = p
    ? `${row.label}: projected ${fmtMarginDR(p.margin)}. ${row.lastTime ? `Last at least this ${p.margin >= 0 ? "Democratic" : "Republican"} in ${row.lastTime}.` : `No election from ${span(row)} was this ${p.margin >= 0 ? "Democratic" : "Republican"}.`}`
    : `${row.label}: no projection yet.`;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      aria-label={summary}
      className={cn(ROW_COLS, "w-full px-2 py-[3px] text-left text-xs transition-colors hover:bg-accent/50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring", selected && "bg-accent")}
    >
      <span className="truncate font-medium">
        {row.label}
        {row.caveat && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground" title="District lines changed; see detail">
            *
          </span>
        )}
      </span>
      <span className="grid h-4 gap-px" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }} aria-hidden>
        {years.map((y) => {
          const m = row.series[String(y)];
          const isLast = row.lastTime === y;
          return (
            <i
              key={y}
              title={m === undefined ? `${y}: no data` : `${y}: ${fmtMarginDR(m)}${isLast ? " (last this way)" : ""}`}
              className={cn("block rounded-[1px]", m === undefined && "bg-muted/40", isLast && "outline outline-2 -outline-offset-1 outline-foreground")}
              style={m === undefined ? undefined : { background: rampColor(m) }}
            />
          );
        })}
      </span>
      <span
        className={cn("tnum flex h-4 items-center justify-end rounded-[2px] px-1 text-right text-[11px] font-semibold", p ? (p.margin >= 0 ? "hatch-d" : "hatch-r") : "text-muted-foreground")}
        title={p ? (p.source === "poll" ? "From the latest poll average" : "From 2024 margin plus national swing (no race poll)") : undefined}
      >
        <span className={cn("rounded-[2px] bg-card/85 px-0.5", p && (p.margin >= 0 ? "text-party-d-ink" : "text-party-r-ink"))}>{p ? fmtMarginDR(p.margin, 1) : "—"}</span>
      </span>
      <span className="tnum text-right text-[11px]">
        {!p ? (
          <span className="text-muted-foreground">—</span>
        ) : row.lastTime ? (
          <span>
            <span className="font-semibold">{row.lastTime}</span>
            {row.lastTime === row.latestYear && <span className="ml-1 text-muted-foreground">latest</span>}
          </span>
        ) : (
          <span className="font-semibold text-alert-ink" title="No election in the data was this far toward the projected side">
            none {span(row)}
          </span>
        )}
      </span>
    </button>
  );
}
