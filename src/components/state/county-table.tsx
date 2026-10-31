"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compact, fmtMarginDR, fmtPct, fmtVotes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fmtOU, ouColor } from "./county-map-panel";
import { ModeChip } from "./state-header";
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

const COLS: { key: SortKey; label: string; title?: string; align?: "right" }[] = [
  { key: "name", label: "County" },
  { key: "pctIn", label: "% in", title: "Share of expected vote reported", align: "right" },
  { key: "votesIn", label: "Votes in", align: "right" },
  { key: "expected", label: "Expected", title: "Estimated final vote (2024 turnout × midterm ratio until precincts give a better read)", align: "right" },
  { key: "dPct", label: "D %", align: "right" },
  { key: "rPct", label: "R %", align: "right" },
  { key: "margin", label: "Margin", title: "Live D − R", align: "right" },
  { key: "margin2024", label: "2024", title: "2024 presidential D − R", align: "right" },
  { key: "benchmark", label: "Bench", title: "Margin this county needs for the race to be tied statewide", align: "right" },
  { key: "overUnder", label: "O/U", title: "Live margin minus benchmark", align: "right" },
  { key: "needs", label: "D needs", title: "Share of the county's remaining vote D needs to hit the benchmark", align: "right" },
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

/** Sortable county table; default order is expected vote (largest counties first). Rows re-order with layout animation. */
export function CountyTable({
  rows,
  selected,
  onSelect,
  className,
}: {
  rows: CountyRow[];
  selected: string | null;
  onSelect: (fips: string | null) => void;
  className?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "expected", dir: -1 });

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const c = cmp(a, b, sort.key);
      // Missing values always sink to the bottom regardless of direction.
      if (a[sort.key] == null || b[sort.key] == null) return c;
      return c * sort.dir;
    });
    return out;
  }, [rows, sort]);

  useEffect(() => {
    if (!selected) return;
    document.getElementById(`county-row-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));

  const anyLive = rows.some((r) => r.live);

  return (
    <div className={cn("overflow-auto rounded-md border max-h-[36rem] scrollbar-thin", className)}>
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            {COLS.map((c) => (
              <TableHead
                key={c.key}
                className={cn("h-8 whitespace-nowrap px-2 select-none", c.align === "right" && "text-right")}
                title={c.title}
                aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              >
                <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === c.key && "text-foreground")}>
                  {c.label}
                  <span className="w-2 text-[9px] text-muted-foreground">{sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
                </button>
              </TableHead>
            ))}
            <TableHead className="h-8 px-2 text-right" title="Vote modes reported: Early, Mail, Election Day">
              Modes
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLS.length + 1} className="py-6 text-center text-muted-foreground">
                No county data for this state yet.
              </TableCell>
            </TableRow>
          )}
          {sorted.map((r) => {
            const key = r.fips ?? r.id;
            const isSel = selected === key;
            const needsBad = r.needs != null && (r.needs > 100 || r.needs < 0);
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
                <TableCell className="whitespace-nowrap px-2 py-1.5 font-medium">{r.name}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum">
                  <PctInCell pct={r.pctIn} />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum">{fmtVotes(r.votesIn)}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum text-muted-foreground">{r.expected != null ? compact.format(Math.round(r.expected)) : "—"}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum text-party-d">{fmtPct(r.dPct)}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum text-party-r">{fmtPct(r.rPct)}</TableCell>
                <TableCell className={cn("px-2 py-1.5 text-right tnum font-medium", r.margin != null && (r.margin > 0 ? "text-party-d" : r.margin < 0 ? "text-party-r" : ""))}>
                  {fmtMarginDR(r.margin)}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum text-muted-foreground">{fmtMarginDR(r.margin2024)}</TableCell>
                <TableCell className="px-2 py-1.5 text-right tnum text-muted-foreground">{fmtMarginDR(r.benchmark)}</TableCell>
                <TableCell className={cn("px-2 py-1.5 text-right tnum font-medium", ouColor(r.overUnder))}>{fmtOU(r.overUnder)}</TableCell>
                <TableCell
                  className={cn("px-2 py-1.5 text-right tnum", needsBad && "text-muted-foreground/70 italic line-through decoration-destructive/60")}
                  title={needsBad ? (r.needs! > 100 ? "More than 100% of the remaining vote — impossible" : "Below 0% — already past the benchmark") : undefined}
                >
                  {r.needs == null ? "—" : r.needs > 100 ? "impossible" : r.needs < 0 ? "locked" : fmtPct(r.needs, 0)}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right">
                  <span className="inline-flex gap-0.5">
                    <ModeChip on={r.modes.early} label="E" title="Early in-person" />
                    <ModeChip on={r.modes.mail} label="M" title="Mail" />
                    <ModeChip on={r.modes.eday} label="ED" title="Election Day" />
                  </span>
                </TableCell>
              </motion.tr>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PctInCell({ pct }: { pct?: number }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  const p = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="h-1.5 w-10 overflow-hidden rounded-sm bg-uncalled/30">
        <span className="block h-full bg-foreground/60 transition-[width] duration-500" style={{ width: `${p}%` }} />
      </span>
      <span className="w-8 text-right">{p}%</span>
    </span>
  );
}
