"use client";

import { raceHref } from "@/lib/race-slug";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { RaceMeta } from "@/data/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { MarginDR, Pct } from "@/components/board/num";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { liveMarginDR, pctIn, ratingRank, shortDistrict, type LiveRace } from "./house-lib";

type SortKey = "state" | "district" | "rating" | "pres2024" | "pctIn" | "margin";
type Sort = { key: SortKey; dir: 1 | -1 };

const PAGE = 60;

/** `live` columns are empty for every district until votes are counted, so they stay hidden until then. */
const COLS: { key: SortKey | null; label: string; className?: string; live?: boolean }[] = [
  { key: "district", label: "District" },
  { key: null, label: "Candidates" },
  { key: "rating", label: "Rating" },
  { key: "pres2024", label: "2024 president", className: "text-right max-sm:hidden" },
  { key: "pctIn", label: "% in", className: "text-right", live: true },
  { key: "margin", label: "Margin", className: "text-right", live: true },
  { key: null, label: "Status", live: true },
];

export function HouseTable({
  metas,
  live,
  hasVotes,
  selected,
  onSelect,
}: {
  metas: RaceMeta[];
  live: Map<string, LiveRace>;
  /** Any House race has votes or a projection: shows % in, margin and status. */
  hasVotes: boolean;
  selected?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "state", dir: 1 });
  const [limit, setLimit] = useState(PAGE);
  const cols = useMemo(() => COLS.filter((c) => hasVotes || !c.live), [hasVotes]);

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
    <div className="space-y-3">
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {cols.map((c) => (
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
              ? [...lr.candidates]
                  .sort((a, b) => b.votes - a.votes)
                  .slice(0, 2)
                  .map((c) => ({ ...c, incumbent: c.incumbent ?? m.candidates.find((x) => x.id === c.id)?.incumbent }))
              : m.candidates.filter((c) => c.party === "D" || c.party === "R").slice(0, 2);
            const winner = lr?.projection?.winnerId;
            const pres = m.baseline.presMargin2024;
            return (
              <TableRow key={m.id} data-state={selected === m.id ? "selected" : undefined} className="cursor-pointer" onClick={() => onSelect?.(m.id)}>
                <TableCell className="font-semibold tnum">
                  <Link href={raceHref(m.id)} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {shortDistrict(m.id)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[18rem]">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {cands.map((c) => (
                      <span key={c.id} className={cn("truncate", c.id === winner && "font-semibold")}>
                        {c.name}
                        <span className="text-muted-foreground">
                          {" "}
                          ({c.party}){c.incumbent && " *"}
                        </span>
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <RatingBadge rating={m.ratings.consensus} />
                </TableCell>
                <TableCell className="text-right tnum max-sm:hidden">{pres != null ? fmtMarginDR(pres) : null}</TableCell>
                {hasVotes && (
                  <>
                    <TableCell className="text-right">{pctIn(lr) != null && <Pct value={pctIn(lr)} digits={0} />}</TableCell>
                    <TableCell className="text-right">{liveMarginDR(lr) != null && <MarginDR value={liveMarginDR(lr)} />}</TableCell>
                    <TableCell>
                      <StatusBadge status={lr?.status ?? "not_started"} party={lr?.projection?.party} />
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
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
