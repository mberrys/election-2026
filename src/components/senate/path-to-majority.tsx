"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { pathsToMajority, ratingLean, type PathToMajority as Path } from "@/analytics";
import { MarginDR, Pct } from "@/components/board/num";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BalanceOfPower, RaceMeta } from "@/data/schema";
import { fmtMarginDR } from "@/lib/format";
import { raceHref } from "@/lib/race-slug";
import { cn } from "@/lib/utils";
import { pollMargin, type LiveIndex } from "./balance";
import { VP_PARTY } from "./chamber-balance";
import { SeatSparkline } from "./seat-sparkline";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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

  const lean = (id: string) => ratingLean(metaById.get(id)?.ratings.consensus);
  const favD = uncalled.filter((u) => lean(u.id) === "D").length;
  const favR = uncalled.filter((u) => lean(u.id) === "R").length;
  const tossups = useMemo(
    () =>
      uncalled
        .filter((u) => ratingLean(u.rating) === "tossup")
        .map((u) => metaById.get(u.id))
        .filter((m): m is RaceMeta => !!m)
        .sort((a, b) => stateName(a.state).localeCompare(stateName(b.state))),
    [uncalled, metaById, stateName],
  );

  const label = (m: RaceMeta) => `${stateName(m.state)}${m.special ? " (special)" : ""}`;
  const byName = (ids: readonly string[]) =>
    ids
      .map((id) => metaById.get(id))
      .filter((m): m is RaceMeta => !!m)
      .map(label)
      .sort((a, b) => a.localeCompare(b));
  const uncalledIds = bop.raceIds?.uncalled ?? [];
  const groups: { title: string; ink?: string; names: string[] }[] = [
    { title: "Won by Democrats", ink: "text-party-d-ink", names: byName([...(bop.raceIds?.calledD ?? []), ...(bop.raceIds?.calledI ?? [])]) },
    { title: "Rated toward Democrats", ink: "text-party-d-ink", names: byName(uncalledIds.filter((id) => lean(id) === "D")) },
    { title: "Toss-ups", names: tossups.map(label) },
    { title: "Rated toward Republicans", ink: "text-party-r-ink", names: byName(uncalledIds.filter((id) => lean(id) === "R")) },
    { title: "Won by Republicans", ink: "text-party-r-ink", names: byName(bop.raceIds?.calledR ?? []) },
  ].filter((g) => g.names.length > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Path to majority</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 text-base font-semibold leading-snug text-pretty">
          <p>
            <PathSentence party="D" path={paths.D} fav={favD} toss={tossups.length} />
          </p>
          <p>
            <PathSentence party="R" path={paths.R} fav={favR} toss={tossups.length} />
          </p>
        </div>

        {tossups.length > 0 && (
          <div>
            <h3 className="text-[15px] font-semibold">
              The {tossups.length === 1 ? "toss-up" : `${tossups.length} toss-ups`}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{tossups.some((m) => live.get(m.id)?.totalVotes) ? "count so far" : "poll average"}</span>
            </h3>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px]">
              {tossups.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2">
                  <Link href={raceHref(m.id)} className="truncate font-semibold hover:underline underline-offset-2">
                    {stateName(m.state)}
                  </Link>
                  <TossupFigure meta={m} live={live} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <SeatSparkline office="senate" majority={bop.majority} />

        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer text-[15px] font-semibold marker:text-muted-foreground hover:text-foreground">
            All {metas.length} seats by party
          </summary>
          <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {groups.map((g) => (
              <p key={g.title}>
                <b className={cn("font-semibold", g.ink ?? "text-foreground")}>
                  {g.title} ({g.names.length}):
                </b>{" "}
                {g.names.join(", ")}
              </p>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

/**
 * One sentence per party, from the seats it already has to its target: the races rated its way,
 * then toss-ups, then seats it would have to flip.
 */
function PathSentence({ party, path, fav, toss }: { party: "D" | "R"; path: Path; fav: number; toss: number }) {
  const who = <span className={party === "D" ? "text-party-d-ink" : "text-party-r-ink"}>{party === "D" ? "Democrats" : "Republicans"}</span>;
  let rest: ReactNode;
  if (path.need === 0) {
    rest = path.target === 50 ? " have 50 seats: control with the Vice President's tie-break." : ` have ${path.have} seats: control secured.`;
  } else if (!path.feasible) {
    rest = ` can no longer reach ${path.target}.`;
  } else if (path.need <= fav) {
    rest = path.need === fav ? ` must hold all ${plural(fav, "seat")} rated their way.` : ` must win ${path.need} of the ${plural(fav, "seat")} rated their way.`;
  } else if (path.need <= fav + toss) {
    const extra = path.need - fav;
    const which = extra === toss ? `all ${plural(toss, "toss-up")}` : `${extra} of the ${plural(toss, "toss-up")}`;
    rest = fav > 0 ? ` must hold the ${plural(fav, "seat")} rated their way and win ${which}.` : ` must win ${which}.`;
  } else {
    const flips = path.need - fav - toss;
    rest = ` must hold the ${plural(fav, "seat")} rated their way, sweep the toss-ups and flip ${plural(flips, "seat")} rated against them.`;
  }
  return (
    <>
      {who}
      {rest}
    </>
  );
}

/** Poll average before counting; the live margin and share counted once votes arrive. */
function TossupFigure({ meta, live }: { meta: RaceMeta; live: LiveIndex }) {
  const race = live.get(meta.id);
  if (race && race.totalVotes > 0) {
    return (
      <span className="shrink-0 tnum">
        <MarginDR value={race.marginDR} /> <span className="text-xs text-muted-foreground">· <Pct value={(race.pctExpected ?? 0) * 100} digits={0} /> in</span>
      </span>
    );
  }
  const poll = pollMargin(meta);
  if (poll == null) return <span className="shrink-0 text-xs text-muted-foreground">No polls</span>;
  return <span className="shrink-0 text-muted-foreground tnum">{fmtMarginDR(poll)}</span>;
}
