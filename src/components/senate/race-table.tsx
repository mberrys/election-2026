"use client";

import { raceHref } from "@/lib/race-slug";
import Link from "next/link";
import { RaceFlags } from "@/components/board/race-flags";
import { annotationsFor } from "@/data/annotations";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { RATING_ORDER, type CandidateMeta, type RaceMeta, type StateMeta } from "@/data/schema";
import { MarginDR, Pct } from "@/components/board/num";
import { RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { compact, fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flipPossible, flippedTo, hasResults, isCalled, isCompetitive, leaderOf, partyInk, pollMargin, type LiveIndex, type LiveRace } from "./balance";

export type RaceFilter = "all" | "tossup" | "flips" | "called";
type SortKey = "state" | "rating" | "margin" | "pctIn";
type SortDir = "asc" | "desc";

const FILTERS: { value: RaceFilter; label: string; liveOnly?: boolean }[] = [
  { value: "all", label: "All" },
  { value: "tossup", label: "Toss-ups" },
  { value: "flips", label: "Flips possible" },
  { value: "called", label: "Called", liveOnly: true },
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

type ShownCandidate = CandidateMeta & { pct?: number };

/**
 * Candidates to show. Counting: by votes, the top two plus a third only if it has at least 5%.
 * Before counting: the D and R nominees (incumbent first within a party), else the top two by party.
 */
function shownCandidates(meta: RaceMeta, race: LiveRace | undefined): ShownCandidate[] {
  if (race && race.totalVotes > 0) {
    const byId = new Map(meta.candidates.map((c) => [c.id, c]));
    return [...race.candidates]
      .sort((a, b) => b.votes - a.votes)
      .filter((c, i) => i < 2 || (i === 2 && c.pct >= 5))
      .map((c) => ({ ...(byId.get(c.id) ?? { id: c.id, name: c.name, party: c.party, incumbent: !!c.incumbent, aliases: [] }), pct: c.pct }));
  }
  return [...meta.candidates]
    .sort((a, b) => PARTY_RANK[a.party] - PARTY_RANK[b.party] || Number(b.incumbent) - Number(a.incumbent))
    .slice(0, 2);
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
  states: readonly Pick<StateMeta, "abbr" | "name">[];
  defaultSort?: SortKey;
  className?: string;
}) {
  const [filter, setFilter] = useState<RaceFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: defaultSort, dir: "asc" });

  const nameByAbbr = useMemo(() => new Map(states.map((s) => [s.abbr, s.name])), [states]);

  const rows = useMemo<Row[]>(
    () => metas.map((meta) => ({ meta, race: live.get(meta.id), stateName: nameByAbbr.get(meta.state) ?? meta.state })),
    [metas, live, nameByAbbr],
  );

  // Columns exist only when at least one row has something to put in them.
  const anyLive = rows.some((r) => hasResults(r.race));
  const cols = {
    polls: rows.some((r) => r.meta.polls),
    cash: rows.some((r) => Object.keys(r.meta.money?.cashOnHand ?? {}).length > 0),
    live: anyLive,
    projection: anyLive && rows.some((r) => r.race?.model),
  };
  const colCount = 3 + Number(cols.polls) + Number(cols.cash) + (cols.live ? 3 : 0) + Number(cols.projection);

  const filters = FILTERS.filter((f) => anyLive || !f.liveOnly);
  const activeFilter = filters.some((f) => f.value === filter) ? filter : "all";

  const visible = useMemo(
    () => rows.filter((r) => matches(r, activeFilter)).sort((a, b) => compare(a, b, sort.key, sort.dir)),
    [rows, activeFilter, sort],
  );

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, rows.filter((r) => matches(r, f.value)).length])) as Record<RaceFilter, number>,
    [rows],
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "state" || key === "rating" ? "asc" : "desc" }));

  const notes = [
    cols.polls && "Poll average is the D − R margin.",
    cols.cash && "Cash on hand from FEC filings.",
    cols.live && "% in is the share of the expected vote counted.",
    cols.projection && "Projection is the model's estimate of the final margin, ± its uncertainty.",
  ].filter(Boolean);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ToggleGroup
          value={[activeFilter]}
          onValueChange={(v) => {
            const next = v[0] as RaceFilter | undefined;
            if (next) setFilter(next);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Filter races"
        >
          {filters.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="gap-1.5">
              {f.label}
              <span className="tnum text-muted-foreground">{counts[f.value]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{anyLive ? "Updates about every 25 seconds." : "Results columns appear once counting starts."}</p>
      </div>

      <ScrollArea className="w-full rounded-lg border border-border bg-card">
        <table
          className={cn("relative w-full caption-bottom text-[15px]", cols.live ? "min-w-[900px] md:min-w-[1040px]" : "min-w-[560px] md:min-w-[720px]")}
          aria-label={office === "senate" ? "Senate races" : "Governor races"}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th k="state" sort={sort} onSort={toggleSort} className="pl-5">
                State
              </Th>
              <Th>Candidates</Th>
              <Th k="rating" sort={sort} onSort={toggleSort} className="hidden md:table-cell">
                Rating
              </Th>
              {cols.polls && <Th className="text-right">Poll avg</Th>}
              {cols.cash && <Th className="text-right">Cash on hand</Th>}
              {cols.live && (
                <>
                  <Th k="pctIn" sort={sort} onSort={toggleSort} className="text-right">
                    % in
                  </Th>
                  <Th k="margin" sort={sort} onSort={toggleSort} className="text-right">
                    Margin
                  </Th>
                  <Th>Status</Th>
                </>
              )}
              {cols.projection && <Th className="pr-5 text-right">Projection</Th>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <RaceRow key={row.meta.id} row={row} cols={cols} />
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
                  No races match this filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {notes.length > 0 && <p className="text-xs text-muted-foreground">{notes.join(" ")}</p>}
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
      className={cn("text-xs text-muted-foreground", className)}
      aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {k && onSort ? (
        <button
          type="button"
          onClick={() => onSort(k)}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
        >
          {children}
          <span aria-hidden className="w-2 text-xs">
            {active ? (sort?.dir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      ) : (
        children
      )}
    </TableHead>
  );
}

/** Joins inline facts with a muted " · ". */
function Facts({ items }: { items: ReactNode[] }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      {shown.map((item, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {item}
        </span>
      ))}
    </div>
  );
}

type Cols = { polls: boolean; cash: boolean; live: boolean; projection: boolean };

function RaceRow({ row, cols }: { row: Row; cols: Cols }) {
  const { meta, race, stateName } = row;
  const cands = shownCandidates(meta, race);
  const counting = !!race && race.totalVotes > 0;
  const winnerId = race?.projection?.winnerId;
  const leaderId = !winnerId && counting ? race?.leaderId : undefined;
  const flip = flippedTo(meta, race);
  const poll = pollMargin(meta);
  const cash = meta.money?.cashOnHand ?? {};
  const pctIn = counting && race?.pctExpected != null ? race.pctExpected * 100 : undefined;
  const flags = race?.flags ?? annotationsFor(meta);

  return (
    <motion.tr
      layout="position"
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
      className="border-b transition-colors hover:bg-muted/40"
      data-race={meta.id}
    >
      <TableCell className="py-5 pl-5 align-top">
        <Link href={raceHref(meta.id)} className="text-base font-bold hover:underline underline-offset-2">
          {stateName}
        </Link>
        {/* Phones: the rating rides under the state name so it is on screen without scrolling the table. */}
        <RatingBadge rating={meta.ratings.consensus} className="mt-1 flex text-sm md:hidden" />
        <Facts
          items={[
            meta.special && "Special",
            flags?.length ? <RaceFlags flags={flags} className="align-baseline" /> : null,
            meta.runoffRule === "majority" && <span title="A candidate needs a majority; otherwise the top two go to a runoff">50% runoff rule</span>,
            meta.heldBy && <span title={`Seat held by ${meta.heldBy}`}>Held {meta.heldBy}</span>,
            flip && <span className={cn("font-semibold", partyInk(flip))}>Flipped to {flip}</span>,
          ]}
        />
      </TableCell>

      <TableCell className="py-5 align-top">
        <ul className="space-y-1">
          {cands.map((c) => (
            <li key={c.id} className="flex items-baseline gap-2 leading-6">
              <span className={cn("max-w-[220px] truncate", partyInk(c.party), (c.id === winnerId || c.id === leaderId) && "font-semibold")}>
                {c.name}
              </span>
              {c.incumbent && <span className="text-xs text-muted-foreground">(inc.)</span>}
              {counting && c.pct != null && <Pct value={c.pct} className="ml-auto pl-3" />}
            </li>
          ))}
        </ul>
      </TableCell>

      <TableCell className="hidden py-5 align-top leading-6 md:table-cell">
        <RatingBadge rating={meta.ratings.consensus} className="text-[15px]" />
      </TableCell>

      {cols.polls && (
        <TableCell className="py-5 align-top text-right tnum leading-6">
          {meta.polls ? (
            <span title={`${meta.polls.source}, as of ${meta.polls.asOf}`}>
              {fmtMarginDR(poll)}
              <span className="block text-xs text-muted-foreground">
                {meta.polls.n} poll{meta.polls.n === 1 ? "" : "s"}
              </span>
            </span>
          ) : isCompetitive(meta.ratings.consensus) ? (
            <span className="text-xs text-muted-foreground">No polls</span>
          ) : null}
        </TableCell>
      )}

      {cols.cash && (
        <TableCell className="py-5 align-top text-right tnum">
          {/* One figure per candidate, on the same line as their name. */}
          <ul className="space-y-1">
            {cands.map((c) => (
              <li key={c.id} className="leading-6">
                {cash[c.id] != null ? (
                  <>
                    <span className="sr-only">{c.name}: </span>${compact.format(cash[c.id])}
                  </>
                ) : (
                  <span aria-hidden>&nbsp;</span>
                )}
              </li>
            ))}
          </ul>
        </TableCell>
      )}

      {cols.live && (
        <>
          <TableCell className="py-5 align-top text-right leading-6">{pctIn != null && <Pct value={pctIn} digits={0} />}</TableCell>
          <TableCell className="py-5 align-top text-right font-medium leading-6">{counting && <MarginDR value={race?.marginDR} />}</TableCell>
          <TableCell className="py-5 align-top">
            <StatusBadge status={race?.status ?? "not_started"} party={race?.projection?.party} leader={counting ? leaderOf(race)?.party : undefined} />
          </TableCell>
        </>
      )}

      {cols.projection && (
        <TableCell className="py-5 pr-5 align-top text-right tnum leading-6">
          {race?.model && (
            <span
              className={cn(
                race.model.projectedMarginDR > 0.5 && "text-party-d-ink",
                race.model.projectedMarginDR < -0.5 && "text-party-r-ink",
                !counting && "text-muted-foreground",
              )}
              title="Model estimate of the final D − R margin with its uncertainty band"
            >
              {fmtMarginDR(race.model.projectedMarginDR, 0)} ±{Math.round(race.model.band)}
            </span>
          )}
        </TableCell>
      )}
    </motion.tr>
  );
}
