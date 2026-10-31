"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PartyDot, RatingBadge, StatusBadge, TierBadge } from "@/components/board/status-badge";
import { MarginDR, Pct } from "@/components/board/num";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { liveMarginDR, pctIn, ratingRank, shortDistrict, type LiveRace } from "./house-lib";

type SortKey = "state" | "district" | "rating" | "pres2024" | "pctIn" | "margin";
type Sort = { key: SortKey; dir: 1 | -1 };

const PAGE = 60;

const COLS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "district", label: "District" },
  { key: null, label: "Candidates" },
  { key: "rating", label: "Rating" },
  { key: "pres2024", label: "2024 pres.", className: "text-right" },
  { key: "pctIn", label: "% in", className: "text-right" },
  { key: "margin", label: "Margin", className: "text-right" },
  { key: null, label: "Status" },
  { key: null, label: "Tier" },
];

export function HouseTable({
  metas,
  states,
  live,
  selected,
  onSelect,
}: {
  metas: RaceMeta[];
  states: StateMeta[];
  live: Map<string, LiveRace>;
  selected?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "state", dir: 1 });
  const [limit, setLimit] = useState(PAGE);
  const stateTier = useMemo(() => new Map(states.map((s) => [s.abbr, s.tier])), [states]);

  const rows = useMemo(() => {
    const val = (m: RaceMeta): number | string => {
      const lr = live.get(m.id);
      switch (sort.key) {
        case "state":
          return m.id;
        case "district":
          return `${m.district ?? ""}-${m.state}`;
        case "rating":
          return ratingRank(m.ratings.consensus);
        case "pres2024":
          return m.baseline.presMargin2024 ?? Number.NEGATIVE_INFINITY;
        case "pctIn":
          return pctIn(lr) ?? -1;
        case "margin":
          return liveMarginDR(lr) ?? Number.NEGATIVE_INFINITY;
      }
    };
    return [...metas].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return c * sort.dir || a.id.localeCompare(b.id);
    });
  }, [metas, live, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const visible = rows.slice(0, limit);

  return (
    <div className="space-y-2">
      <Table className="text-xs md:text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLS.map((c) => (
              <TableHead
                key={c.label}
                className={cn("text-xs", c.className)}
                aria-sort={c.key ? (sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none") : undefined}
              >
                {c.key ? (
                  <button
                    type="button"
                    onClick={() => toggle(c.key!)}
                    className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === c.key ? "text-foreground" : "text-muted-foreground")}
                  >
                    {c.label}
                    {sort.key === c.key && (sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                  </button>
                ) : (
                  <span className="text-muted-foreground">{c.label}</span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((m) => {
            const lr = live.get(m.id);
            const cands = lr?.candidates?.length
              ? [...lr.candidates].sort((a, b) => b.votes - a.votes).slice(0, 2).map((c) => ({ ...c, incumbent: c.incumbent ?? m.candidates.find((x) => x.id === c.id)?.incumbent }))
              : m.candidates.filter((c) => c.party === "D" || c.party === "R").slice(0, 2);
            const winner = lr?.projection?.winnerId;
            return (
              <TableRow
                key={m.id}
                data-state={selected === m.id ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect?.(m.id)}
              >
                <TableCell className="font-semibold tnum">
                  <Link href={`/state/${m.state}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {shortDistrict(m.id)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[16rem]">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {cands.length === 0 && <span className="text-muted-foreground">—</span>}
                    {cands.map((c) => (
                      <span key={c.id} className={cn("inline-flex items-center gap-1.5 truncate", c.id === winner && "font-semibold")}>
                        <PartyDot party={c.party} />
                        <span className="truncate">{c.name}</span>
                        {c.incumbent && <span className="text-muted-foreground">*</span>}
                        {c.id === winner && <span className="text-[10px] text-muted-foreground">✓</span>}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <RatingBadge rating={m.ratings.consensus} />
                </TableCell>
                <TableCell className={cn("text-right tnum", (m.baseline.presMargin2024 ?? 0) > 0 ? "text-party-d" : (m.baseline.presMargin2024 ?? 0) < 0 ? "text-party-r" : "text-muted-foreground")}>
                  {fmtMarginDR(m.baseline.presMargin2024)}
                </TableCell>
                <TableCell className="text-right">
                  <Pct value={pctIn(lr)} digits={0} />
                </TableCell>
                <TableCell className="text-right">
                  <MarginDR value={liveMarginDR(lr)} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={lr?.status ?? "not_started"} party={lr?.projection?.party} />
                </TableCell>
                <TableCell>
                  <TierBadge tier={lr?.source.tier ?? stateTier.get(m.state)} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="tnum">
          Showing {Math.min(limit, rows.length)} of {rows.length} districts · * incumbent
        </span>
        <div className="flex gap-2">
          {limit < rows.length && (
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Show more
            </Button>
          )}
          {limit < rows.length && (
            <Button variant="ghost" size="sm" onClick={() => setLimit(rows.length)}>
              Show all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
