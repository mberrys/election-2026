"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { rampStep } from "@/components/board/hatch";
import type { HistoryRowModel } from "@/analytics/history";
import { fmtMarginDR } from "@/lib/format";
import { raceHref } from "@/lib/race-slug";
import { cn } from "@/lib/utils";

interface Props {
  rows: HistoryRowModel[];
  /** Pinned above the list regardless of sort (the national row). */
  pinned?: HistoryRowModel;
  /** Noun for the unit column header. */
  unitLabel: string;
}

/** Phones: name, 2026 and last-time on one line, the strip full width below. Wider: one line per place. */
const ROW_COLS =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_4.5rem_6.5rem] sm:gap-x-5 lg:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_5rem_7.5rem]";

/** Strip cells stay on the light half of the ramp (steps 1–3) so a long table reads calmly. */
const stripColor = (m: number) => `var(--ramp-${m >= 0 ? "d" : "r"}-${Math.min(rampStep(m), 3)})`;
const partyInk = (m: number) => (m >= 0 ? "text-party-d-ink" : "text-party-r-ink");
const short = (y: number) => `’${String(y).slice(2)}`;

/** Indices to label at a given density: every k-th, plus the last, never crowding the last. */
function labelled(n: number, k: number): Set<number> {
  const out = new Set<number>([n - 1]);
  for (let i = 0; i < n - 1; i += k) if (n - 1 - i >= Math.min(k, 2)) out.add(i);
  return out;
}

/**
 * One row per place: a cell per past election on the margin ramp, then the 2026 projection as an outlined cell
 * (the row's only highlight). Rows link to the state or district page.
 */
export function HistoryStrips({ rows, pinned, unitLabel }: Props) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of [...(pinned ? [pinned] : []), ...rows]) for (const y of Object.keys(r.series)) set.add(Number(y));
    return [...set].sort((a, b) => a - b);
  }, [rows, pinned]);

  const cells = years.length + 1;
  const wide = labelled(cells, cells > 16 ? 2 : 1);
  const narrow = labelled(cells, cells > 16 ? 4 : 2);
  const labels = [...years, 2026];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" role="group" aria-label={`${unitLabel} election history`}>
      <div className={cn(ROW_COLS, "border-b border-border px-3 py-3 text-[13px] font-semibold text-ink-muted sm:px-5")}>
        <span>{unitLabel}</span>
        <div className="col-span-3 row-start-2 grid gap-[2px] sm:col-span-1 sm:row-start-auto" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }} aria-hidden>
          {labels.map((y, i) => {
            const show = wide.has(i) || narrow.has(i);
            return (
              <span
                key={y}
                className={cn(
                  "overflow-visible text-center text-[12px] font-medium whitespace-nowrap tnum",
                  !show && "invisible",
                  wide.has(i) && !narrow.has(i) && "max-lg:invisible",
                  !wide.has(i) && narrow.has(i) && "lg:invisible",
                  i === cells - 1 && "font-bold text-ink",
                )}
              >
                {short(y)}
              </span>
            );
          })}
        </div>
        <span className="text-right">2026</span>
        <span className="text-right">Last this way</span>
      </div>
      <ul className="divide-y divide-border">
        {pinned && (
          <li className="bg-s3/40">
            <Row row={pinned} years={years} />
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id}>
            <Row row={r} years={years} />
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-6 text-center text-[15px] text-ink-muted">No matches.</li>}
      </ul>
    </div>
  );
}

/** "1976": the first year this row has data for. */
function firstYear(row: HistoryRowModel): number {
  return Math.min(...Object.keys(row.series).map(Number));
}

function hrefFor(row: HistoryRowModel): string | undefined {
  if (row.kind === "state") return `/state/${row.id}`;
  if (row.kind === "district") return raceHref(`house:${row.id}`);
  return undefined;
}

const Row = memo(function Row({ row, years }: { row: HistoryRowModel; years: number[] }) {
  const p = row.projection;
  const sideWord = p && p.margin >= 0 ? "Democratic" : "Republican";
  const summary = p
    ? `${row.label}: projected ${fmtMarginDR(p.margin)}. ${row.lastTime ? `Last at least this ${sideWord} in ${row.lastTime}.` : `No election since ${firstYear(row)} was this ${sideWord}.`}`
    : `${row.label}: no projection yet.`;
  const href = hrefFor(row);
  const cls = cn(ROW_COLS, "px-3 py-2.5 text-[15px] sm:px-5", href && "transition-colors hover:bg-s3 focus-visible:bg-s3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring");

  const content = (
    <>
      <span className="truncate font-bold">
        {row.label}
        {row.caveat && (
          <span className="ml-1 font-normal text-ink-muted" title="District lines changed; see the note under the table">
            *
          </span>
        )}
      </span>
      <span className="col-span-3 row-start-2 grid h-4 gap-[2px] sm:col-span-1 sm:row-start-auto" style={{ gridTemplateColumns: `repeat(${years.length + 1}, minmax(0, 1fr))` }} aria-hidden>
        {years.map((y) => {
          const m = row.series[String(y)];
          return (
            <i
              key={y}
              title={m === undefined ? undefined : `${y}: ${fmtMarginDR(m)}`}
              className={cn("block rounded-[2px]", m === undefined && "bg-s3/50")}
              style={m === undefined ? undefined : { backgroundColor: stripColor(m) }}
            />
          );
        })}
        <i
          title={p ? `2026 projected: ${fmtMarginDR(p.margin)}` : undefined}
          className={cn("block rounded-[2px]", p ? "outline-2 -outline-offset-2 outline-ink" : "bg-s3/50")}
          style={p ? { backgroundColor: stripColor(p.margin) } : undefined}
        />
      </span>
      <span className={cn("text-right font-semibold tnum", p && partyInk(p.margin))}>{p ? fmtMarginDR(p.margin) : null}</span>
      <span className="text-right tnum">
        {!p ? null : row.lastTime ? (
          <span className="font-medium">{row.lastTime}</span>
        ) : (
          <span className="text-ink-muted" title={`No election since ${firstYear(row)} was this ${sideWord}`}>
            No match
          </span>
        )}
      </span>
    </>
  );

  return href ? (
    <Link href={href} prefetch={false} aria-label={summary} className={cls}>
      {content}
    </Link>
  ) : (
    <div aria-label={summary} role="group" className={cls}>
      {content}
    </div>
  );
});
