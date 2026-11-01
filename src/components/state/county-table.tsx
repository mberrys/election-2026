"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compact, fmtMarginDR, fmtPct, fmtVotes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fmtOU, ouColor } from "./county-map-panel";
import { ModeCodes } from "./state-header";
import type { CountyRow } from "./derive";

type SortKey =
  | "name"
  | "pctIn"
  | "votesIn"
  | "expected"
  | "dPct"
  | "rPct"
  | "margin"
  | "margin2024"
  | "benchmark"
  | "overUnder"
  | "needs";

type Col = { key: SortKey; label: string; title?: string; align?: "right"; live?: boolean };

/** `live` columns are empty for every county until votes are counted, so they stay hidden until then. */
const COLS: Col[] = [
  { key: "name", label: "County" },
  { key: "pctIn", label: "% in", title: "Share of expected vote reported", align: "right", live: true },
  { key: "votesIn", label: "Votes in", align: "right", live: true },
  { key: "expected", label: "Est. vote", title: "Estimated final vote (2024 turnout × midterm ratio until precincts give a better read)", align: "right" },
  { key: "dPct", label: "D %", align: "right", live: true },
  { key: "rPct", label: "R %", align: "right", live: true },
  { key: "margin", label: "Margin", title: "Live D − R", align: "right", live: true },
  { key: "margin2024", label: "2024", title: "2024 presidential D − R", align: "right" },
  { key: "benchmark", label: "Benchmark", title: "Margin this county needs for the race to be tied statewide", align: "right" },
  { key: "overUnder", label: "O/U", title: "Live margin minus benchmark", align: "right", live: true },
  { key: "needs", label: "D needs", title: "Share of the county's remaining vote D needs to hit the benchmark", align: "right", live: true },
];

function cmp(a: CountyRow, b: CountyRow, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name);
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return av - bv;
}

const marginInk = (m: number | undefined) => (m == null ? undefined : m > 0 ? "text-party-d-ink" : m < 0 ? "text-party-r-ink" : undefined);

/** Sortable county table; default order is expected vote (largest counties first). Rows re-order with layout animation. */
export function CountyTable({
  rows,
  selected,
  onSelect,
  hasVotes,
  className,
}: {
  rows: CountyRow[];
  selected: string | null;
  onSelect: (fips: string | null) => void;
  /** Any county has counted votes: shows the live columns. */
  hasVotes: boolean;
  className?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "expected", dir: -1 });
  const cols = useMemo(() => COLS.filter((c) => hasVotes || !c.live), [hasVotes]);
  // A live column chosen for sorting falls back to expected vote if the live columns go away.
  const sortKey = cols.some((c) => c.key === sort.key) ? sort.key : "expected";

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const c = cmp(a, b, sortKey);
      // Missing values always sink to the bottom regardless of direction.
      if (a[sortKey] == null || b[sortKey] == null) return c;
      return c * sort.dir;
    });
    return out;
  }, [rows, sortKey, sort.dir]);

  useEffect(() => {
    if (!selected) return;
    document.getElementById(`county-row-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));

  const anyLive = rows.some((r) => r.live);
  const showModes = rows.some((r) => r.modes.early || r.modes.mail || r.modes.eday);

  return (
    <div className={cn("max-h-[36rem] overflow-auto rounded-md border scrollbar-thin", className)}>
      <Table className="text-sm">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            {cols.map((c) => (
              <TableHead
                key={c.key}
                className={cn("h-10 select-none whitespace-nowrap px-3 text-xs", c.align === "right" && "text-right")}
                title={c.title}
                aria-sort={sortKey === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cn("inline-flex items-center gap-1 hover:text-foreground", sortKey === c.key ? "text-foreground" : "text-muted-foreground")}
                >
                  {c.label}
                  <span className="w-2.5 text-xs" aria-hidden>
                    {sortKey === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}
                  </span>
                </button>
              </TableHead>
            ))}
            {showModes && (
              <TableHead className="h-10 px-3 text-right text-xs text-muted-foreground" title="Vote modes reported: Early in-person, Mail, Election Day">
                Modes
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={cols.length + (showModes ? 1 : 0)} className="py-6 text-center text-muted-foreground">
                No county data for this state yet.
              </TableCell>
            </TableRow>
          )}
          {sorted.map((r) => {
            const key = r.fips ?? r.id;
            const isSel = selected === key;
            return (
              <motion.tr
                key={key}
                layout="position"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                id={`county-row-${key}`}
                onClick={() => onSelect(isSel ? null : key)}
                className={cn(
                  "cursor-pointer border-b transition-colors hover:bg-muted/50 data-[selected=true]:bg-accent/60",
                  !r.live && anyLive && "text-muted-foreground",
                )}
                data-selected={isSel}
                aria-selected={isSel}
              >
                {cols.map((c) => (
                  <Cell key={c.key} col={c} row={r} />
                ))}
                {showModes && (
                  <TableCell className="px-3 py-2 text-right">
                    <ModeCodes present={r.modes} />
                  </TableCell>
                )}
              </motion.tr>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Cell({ col, row: r }: { col: Col; row: CountyRow }) {
  const base = "px-3 py-2 text-right tnum";
  switch (col.key) {
    case "name":
      return <TableCell className="whitespace-nowrap px-3 py-2 font-medium">{r.name}</TableCell>;
    case "pctIn":
      return (
        <TableCell className={base}>
          <PctInCell pct={r.live ? r.pctIn : undefined} />
        </TableCell>
      );
    case "votesIn":
      return <TableCell className={base}>{r.votesIn > 0 ? fmtVotes(r.votesIn) : null}</TableCell>;
    case "expected":
      return <TableCell className={cn(base, "text-muted-foreground")}>{r.expected != null ? compact.format(Math.round(r.expected)) : null}</TableCell>;
    case "dPct":
      return <TableCell className={cn(base, "text-party-d-ink")}>{r.dPct != null ? fmtPct(r.dPct) : null}</TableCell>;
    case "rPct":
      return <TableCell className={cn(base, "text-party-r-ink")}>{r.rPct != null ? fmtPct(r.rPct) : null}</TableCell>;
    case "margin":
      return <TableCell className={cn(base, "font-medium", marginInk(r.margin))}>{r.margin != null ? fmtMarginDR(r.margin) : null}</TableCell>;
    case "margin2024":
      return <TableCell className={cn(base, marginInk(r.margin2024))}>{r.margin2024 != null ? fmtMarginDR(r.margin2024) : null}</TableCell>;
    case "benchmark":
      return <TableCell className={cn(base, "text-muted-foreground")}>{r.benchmark != null ? fmtMarginDR(r.benchmark) : null}</TableCell>;
    case "overUnder":
      return <TableCell className={cn(base, "font-medium", ouColor(r.overUnder))}>{r.overUnder != null ? fmtOU(r.overUnder) : null}</TableCell>;
    case "needs": {
      const bad = r.needs != null && (r.needs > 100 || r.needs < 0);
      return (
        <TableCell
          className={cn(base, bad && "italic text-muted-foreground")}
          title={bad ? (r.needs! > 100 ? "More than 100% of the remaining vote: impossible" : "Below 0%: already past the benchmark") : undefined}
        >
          {r.needs == null ? null : r.needs > 100 ? "impossible" : r.needs < 0 ? "locked" : fmtPct(r.needs, 0)}
        </TableCell>
      );
    }
  }
}

function PctInCell({ pct }: { pct?: number }) {
  if (pct == null) return null;
  const p = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-10 overflow-hidden rounded-sm bg-s3">
        <span className="block h-full bg-foreground/60 transition-[width] duration-500" style={{ width: `${p}%` }} />
      </span>
      <span className="w-9 text-right">{p}%</span>
    </span>
  );
}
