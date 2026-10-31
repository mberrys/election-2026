"use client";

import Link from "next/link";
import { useMemo } from "react";
import { pathsToMajority, ratingLean, type PathToMajority as Path } from "@/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BalanceOfPower, RaceMeta } from "@/data/schema";
import { fmtMarginDR, ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { leaderOf, type LiveIndex } from "./balance";
import { VP_PARTY } from "./chamber-balance";
import { SeatSparkline } from "./seat-sparkline";

export function PathToMajority({
  bop,
  metas,
  live,
  stateName,
  className,
}: {
  bop: BalanceOfPower;
  metas: readonly RaceMeta[];
  live: LiveIndex;
  stateName: (abbr: string) => string;
  className?: string;
}) {
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas]);
  const uncalled = useMemo(
    () => (bop.raceIds?.uncalled ?? []).map((id) => ({ id, rating: metaById.get(id)?.ratings.consensus })),
    [bop, metaById],
  );
  const paths = useMemo(() => pathsToMajority(bop, uncalled, { vpParty: VP_PARTY }), [bop, uncalled]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Path to majority</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <PartyPath party="D" path={paths.D} won={bop.raceIds?.calledD.concat(bop.raceIds.calledI) ?? []} metaById={metaById} live={live} stateName={stateName} uncalledCount={uncalled.length} />
        <PartyPath party="R" path={paths.R} won={bop.raceIds?.calledR ?? []} metaById={metaById} live={live} stateName={stateName} uncalledCount={uncalled.length} />
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Seats on the board through the night</span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-1.5 w-3 bg-party-d" /> D+I
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-1.5 w-3 bg-party-r" /> R
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-px w-3 border-t border-dashed border-foreground/60" /> {bop.majority}
              </span>
            </span>
          </div>
          <SeatSparkline office="senate" majority={bop.majority} />
        </div>
      </CardContent>
    </Card>
  );
}

function PartyPath({
  party,
  path,
  won,
  metaById,
  live,
  stateName,
  uncalledCount,
}: {
  party: "D" | "R";
  path: Path;
  won: string[];
  metaById: Map<string, RaceMeta>;
  live: LiveIndex;
  stateName: (abbr: string) => string;
  uncalledCount: number;
}) {
  const label = party === "D" ? "Democrats" : "Republicans";
  const color = party === "D" ? "text-party-d-ink" : "text-party-r-ink";
  const headline =
    path.need === 0
      ? `${label} are at ${path.have}: control ${path.target === 50 ? "via the VP tie-break" : "secured"}`
      : !path.feasible
        ? `${label} have ${path.have}; no path to ${path.target} (${uncalledCount} uncalled)`
        : `${label} have ${path.have}, need ${path.need} more to reach ${path.target}`;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className={cn("text-sm font-semibold", color)}>{headline}</div>
        {path.need > 0 && path.feasible && (
          <div className="text-[11px] text-muted-foreground tnum">
            Cheapest path: must win <b className="text-foreground">{path.mustWinNonLeaning}</b> toss-up/opposing-lean seat
            {path.mustWinNonLeaning === 1 ? "" : "s"}
          </div>
        )}
      </div>
      <ol className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`${label} path to majority`}>
        {won.map((id) => {
          const m = metaById.get(id);
          return m ? <Chip key={id} meta={m} party={party} live={live} stateName={stateName} state="won" /> : null;
        })}
        {won.length > 0 && path.path.length > 0 && <li aria-hidden className="mx-0.5 text-muted-foreground">›</li>}
        {path.path.map((id) => {
          const m = metaById.get(id);
          return m ? <Chip key={id} meta={m} party={party} live={live} stateName={stateName} state="needed" /> : null;
        })}
        {path.need === 0 && won.length === 0 && <li className="text-xs text-muted-foreground">No seats needed from tonight&apos;s races.</li>}
      </ol>
    </div>
  );
}

function Chip({
  meta,
  party,
  live,
  stateName,
  state,
}: {
  meta: RaceMeta;
  party: "D" | "R";
  live: LiveIndex;
  stateName: (abbr: string) => string;
  state: "won" | "needed";
}) {
  const rating = meta.ratings.consensus;
  const lean = ratingLean(rating);
  const race = live.get(meta.id);
  const counting = !!race && race.totalVotes > 0;
  const leader = leaderOf(race);
  const favorable = lean === party;
  const hostile = lean !== "tossup" && lean !== party;
  const solid = party === "D" ? "bg-party-d text-white border-party-d" : "bg-party-r text-white border-party-r";
  const soft = party === "D" ? "bg-party-d-faint border-party-d/40 text-party-d-ink" : "bg-party-r-faint border-party-r/40 text-party-r-ink";
  const title = [
    `${stateName(meta.state)}${meta.special ? " (special)" : ""}`,
    rating ? ratingLabel[rating] : "Unrated",
    counting && race ? `${Math.round((race.pctExpected ?? 0) * 100)}% in, ${fmtMarginDR(race.marginDR)}` : undefined,
    state === "won" && leader ? `Projected: ${leader.name}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/state/${meta.state}`}
        title={title}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold tnum transition-colors hover:brightness-110",
          state === "won" && solid,
          state === "needed" && favorable && soft,
          state === "needed" && lean === "tossup" && "border-dashed border-foreground/40 bg-uncalled/40 text-foreground",
          state === "needed" && hostile && "border-dashed border-foreground/30 bg-transparent text-muted-foreground",
        )}
      >
        {meta.state}
        {meta.special && <span className="text-[11px] font-normal opacity-80">sp</span>}
        {state === "needed" && (lean === "tossup" || hostile) && (
          <span className="text-[11px] font-normal opacity-80">{lean === "tossup" ? "toss" : "flip"}</span>
        )}
        {counting && state === "needed" && (
          <span
            className={cn(
              "ml-0.5 text-[11px] font-medium",
              leader?.party === party ? "text-live" : leader ? "text-stale" : "opacity-70",
            )}
          >
            {leader ? `${leader.party} ${fmtMarginDR(race?.marginDR, 1).replace(/^[DR]\+/, "+")}` : "…"}
          </span>
        )}
      </Link>
    </li>
  );
}
