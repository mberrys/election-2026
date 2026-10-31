"use client";

import Link from "next/link";
import { RaceFlags } from "@/components/board/race-flags";
import { annotationsFor } from "@/data/annotations";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { RATING_ORDER, type CandidateMeta, type RaceMeta, type StateMeta } from "@/data/schema";
import { MarginDR, Pct } from "@/components/board/num";
import { PartyDot, RatingBadge, StatusBadge, TierBadge } from "@/components/board/status-badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { compact, fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flipPossible, flippedTo, isCalled, pollMargin, type LiveIndex, type LiveRace } from "./balance";

export type RaceFilter = "all" | "tossup" | "flips" | "called";
type SortKey = "state" | "rating" | "margin" | "pctIn";
type SortDir = "asc" | "desc";

const FILTERS: { value: RaceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tossup", label: "Toss-ups" },
  { value: "flips", label: "Flips possible" },
  { value: "called", label: "Called" },
];

type Row = { meta: RaceMeta; race: LiveRace | undefined; stateName: string };

function ratingIndex(m: RaceMeta): number {
  const r = m.ratings.consensus;
  return r ? RATING_ORDER.indexOf(r) : RATING_ORDER.indexOf("tossup");
}

function marginFor(row: Row): number | undefined {
  return row.race?.marginDR ?? pollMargin(row.meta);
}

function compare(a: Row, b: Row, key: SortKey, dir: SortDir): number {
  const byState = a.meta.state.localeCompare(b.meta.state) || a.meta.id.localeCompare(b.meta.id);
  const sign = dir === "asc" ? 1 : -1;
  if (key === "state") return sign * byState;
  if (key === "rating") return sign * (ratingIndex(a.meta) - ratingIndex(b.meta)) || byState;
  const av = key === "margin" ? marginFor(a) : a.race?.pctExpected;
  const bv = key === "margin" ? marginFor(b) : b.race?.pctExpected;
  if (av == null && bv == null) return byState;
  if (av == null) return 1; // missing values sink regardless of direction
  if (bv == null) return -1;
  return sign * (av - bv) || byState;
}

function matches(row: Row, filter: RaceFilter): boolean {
  switch (filter) {
    case "tossup":
      return row.meta.ratings.consensus === "tossup" || !row.meta.ratings.consensus;
    case "flips":
      return flipPossible(row.meta, row.race);
    case "called":
      return isCalled(row.race);
    default:
      return true;
  }
}

const PARTY_RANK = { D: 0, R: 1, I: 2, L: 3, G: 3, O: 4 } as const;

/** Candidates to show: by live votes when counting, else D, R, then others. At most three. */
function orderedCandidates(meta: RaceMeta, race: LiveRace | undefined): (CandidateMeta & { pct?: number })[] {
  if (race && race.totalVotes > 0) {
    const byId = new Map(meta.candidates.map((c) => [c.id, c]));
    return [...race.candidates]
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3)
      .map((c) => ({ ...(byId.get(c.id) ?? { id: c.id, name: c.name, party: c.party, incumbent: !!c.incumbent, aliases: [] }), pct: c.pct }));
  }
  return [...meta.candidates].sort((a, b) => PARTY_RANK[a.party] - PARTY_RANK[b.party]).slice(0, 3);
}

export function RaceTable({
  office,
  metas,
  live,
  states,
  defaultSort = "rating",
  className,
}: {
  office: "senate" | "governor";
  metas: readonly RaceMeta[];
  live: LiveIndex;
  states: readonly Pick<StateMeta, "abbr" | "name" | "tier">[];
  defaultSort?: SortKey;
  className?: string;
}) {
  const [filter, setFilter] = useState<RaceFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: defaultSort, dir: "asc" });

  const stateByAbbr = useMemo(() => new Map(states.map((s) => [s.abbr, s])), [states]);

  const rows = useMemo<Row[]>(
    () => metas.map((meta) => ({ meta, race: live.get(meta.id), stateName: stateByAbbr.get(meta.state)?.name ?? meta.state })),
    [metas, live, stateByAbbr],
  );

  const visible = useMemo(
    () => rows.filter((r) => matches(r, filter)).sort((a, b) => compare(a, b, sort.key, sort.dir)),
    [rows, filter, sort],
  );

  const anyLive = rows.some((r) => r.race);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, rows.filter((r) => matches(r, f.value)).length])) as Record<RaceFilter, number>,
    [rows],
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "state" || key === "rating" ? "asc" : "desc" }));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => {
            const next = v[0] as RaceFilter | undefined;
            if (next) setFilter(next);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Filter races"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="gap-1.5">
              {f.label}
              <span className="tnum text-[10px] text-muted-foreground">{counts[f.value]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-[11px] text-muted-foreground">
          {anyLive ? "Live columns update every ~25s." : "Pre-election view: ratings, polls and money. Live columns fill in as counting begins."}
        </p>
      </div>

      <ScrollArea className="w-full rounded-md border border-border/60">
        <table className="w-full caption-bottom text-sm min-w-[1100px]" aria-label={office === "senate" ? "Senate races" : "Governor races"}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th k="state" sort={sort} onSort={toggleSort}>State</Th>
              <Th>Candidates</Th>
              <Th k="rating" sort={sort} onSort={toggleSort}>Rating</Th>
              <Th className="text-right">Poll avg</Th>
              <Th className="text-right">Cash on hand</Th>
              <Th k="pctIn" sort={sort} onSort={toggleSort} className="text-right">% in</Th>
              <Th k="margin" sort={sort} onSort={toggleSort} className="text-right">Margin</Th>
              <Th>Status</Th>
              <Th className="text-right">Projection</Th>
              <Th>Tier</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <RaceRow key={row.meta.id} row={row} expectedTier={stateByAbbr.get(row.meta.state)?.tier} />
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  No races match this filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="text-[11px] text-muted-foreground">
        * incumbent · margins are D − R · % in is share of expected vote counted · cash on hand per FEC filings
      </p>
    </div>
  );
}

function Th({
  k,
  sort,
  onSort,
  children,
  className,
}: {
  k?: SortKey;
  sort?: { key: SortKey; dir: SortDir };
  onSort?: (k: SortKey) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = k && sort?.key === k;
  return (
    <TableHead
      className={cn("text-[11px] uppercase tracking-wider text-muted-foreground", className)}
      aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {k && onSort ? (
        <button
          type="button"
          onClick={() => onSort(k)}
          className={cn("inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground", active && "text-foreground")}
        >
          {children}
          <span aria-hidden className="w-2 text-[9px]">
            {active ? (sort?.dir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      ) : (
        children
      )}
    </TableHead>
  );
}

function RaceRow({ row, expectedTier }: { row: Row; expectedTier?: StateMeta["tier"] }) {
  const { meta, race, stateName } = row;
  const cands = orderedCandidates(meta, race);
  const winnerId = race?.projection?.winnerId;
  const leaderId = !winnerId && race && race.totalVotes > 0 ? race.leaderId : undefined;
  const flip = flippedTo(meta, race);
  const poll = pollMargin(meta);
  const cash = meta.money?.cashOnHand ?? {};
  const cashRows = [...meta.candidates]
    .filter((c) => cash[c.id] != null)
    .sort((a, b) => PARTY_RANK[a.party] - PARTY_RANK[b.party])
    .slice(0, 3);
  const pctIn = race?.pctExpected != null ? race.pctExpected * 100 : undefined;

  return (
    <motion.tr
      layout="position"
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
      className={cn(
        "border-b transition-colors hover:bg-muted/40",
        isCalled(race) && (race?.projection?.party === "D" ? "bg-party-d-faint/40" : race?.projection?.party === "R" ? "bg-party-r-faint/40" : ""),
      )}
      data-race={meta.id}
    >
      <TableCell className="align-top">
        <div className="flex flex-col gap-0.5">
          <Link href={`/state/${meta.state}`} className="font-semibold hover:underline underline-offset-2">
            {stateName} <span className="tnum text-[11px] text-muted-foreground">{meta.state}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {meta.special && <span className="rounded border border-border px-1">Special</span>}
            <RaceFlags flags={race?.flags ?? annotationsFor(meta)} className="normal-case tracking-normal" />
            {meta.runoffRule === "majority" && (
              <span className="rounded border border-stale/50 px-1 text-stale" title="Majority required; otherwise a runoff">
                50% runoff rule
              </span>
            )}
            {meta.heldBy && (
              <span title={`Seat held by ${meta.heldBy}`}>
                Held {meta.heldBy}
              </span>
            )}
            {flip && <span className={cn("font-semibold", flip === "D" ? "text-party-d-ink" : "text-party-r-ink")}>Flip → {flip}</span>}
          </div>
        </div>
      </TableCell>

      <TableCell className="align-top">
        <ul className="space-y-0.5">
          {cands.map((c) => {
            const isWinner = c.id === winnerId;
            const isLeader = c.id === leaderId;
            return (
              <li key={c.id} className="flex items-center gap-2 whitespace-nowrap">
                <PartyDot party={c.party} />
                <span className={cn("truncate max-w-[180px]", (isWinner || isLeader) && "font-semibold")}>
                  {c.name}
                  {c.incumbent && <span className="text-muted-foreground"> *</span>}
                </span>
                {isWinner && <span className="text-[10px] text-muted-foreground">✓</span>}
                {c.pct != null && race && race.totalVotes > 0 && (
                  <Pct value={c.pct} className="ml-auto text-xs text-muted-foreground" />
                )}
              </li>
            );
          })}
        </ul>
      </TableCell>

      <TableCell className="align-top">
        <RatingBadge rating={meta.ratings.consensus} />
        {!meta.ratings.consensus && <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>

      <TableCell className="align-top text-right tnum">
        {meta.polls ? (
          <span title={`${meta.polls.source}, as of ${meta.polls.asOf}`}>
            <span className={cn(poll != null && poll > 0 && "text-party-d-ink", poll != null && poll < 0 && "text-party-r-ink")}>
              {fmtMarginDR(poll)}
            </span>{" "}
            <span className="text-[11px] text-muted-foreground">(n={meta.polls.n})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="align-top text-right tnum">
        {cashRows.length ? (
          <ul className="space-y-0.5 text-xs">
            {cashRows.map((c) => (
              <li key={c.id} className="flex items-center justify-end gap-1.5">
                <span className={cn("text-[10px]", c.party === "D" ? "text-party-d-ink" : c.party === "R" ? "text-party-r-ink" : "text-party-i")}>{c.party}</span>
                <span>${compact.format(cash[c.id])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="align-top text-right">
        {pctIn != null ? <Pct value={pctIn} digits={0} /> : <span className="text-muted-foreground">—</span>}
      </TableCell>

      <TableCell className="align-top text-right font-medium">
        {race && race.totalVotes > 0 ? <MarginDR value={race.marginDR} /> : <span className="text-muted-foreground">—</span>}
      </TableCell>

      <TableCell className="align-top">
        <StatusBadge status={race?.status ?? "not_started"} party={race?.projection?.party} />
      </TableCell>

      <TableCell className="align-top text-right tnum text-xs">
        {race?.model ? (
          <span
            className={cn(
              race.model.projectedMarginDR > 0.5 && "text-party-d-ink",
              race.model.projectedMarginDR < -0.5 && "text-party-r-ink",
              (!race.totalVotes || race.status === "not_started") && "text-muted-foreground",
            )}
            title="Model estimate of the final D − R margin with its uncertainty band"
          >
            {fmtMarginDR(race.model.projectedMarginDR, 0)} ±{Math.round(race.model.band)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="align-top">
        {race?.source?.tier ? (
          <TierBadge tier={race.source.tier} />
        ) : expectedTier ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70" title="Expected feed tier before counting begins">
            {expectedTier} · expected
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </motion.tr>
  );
}
