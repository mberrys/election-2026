"use client";

import type { ReactNode } from "react";

import { useMemo } from "react";
import { indexRaces, useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { BalanceBar } from "@/components/board/balance-bar";
import { Card, CardContent } from "@/components/ui/card";
import type { PhotoMap } from "@/data/reference/images";
import type { Party, RaceMeta, StateMeta } from "@/data/schema";
import { cn } from "@/lib/utils";
import { buildBalance, EMPTY_LIVE, flippedTo, partyInk, stateNameLookup, type LiveIndex } from "@/components/senate/balance";
import { HeroCount } from "@/components/senate/chamber-balance";
import { RaceTable } from "@/components/senate/race-table";
import { SeatBar } from "@/components/senate/seat-bar";
import { useCallAnnouncer } from "@/components/senate/use-call-announcer";
import { GovernorTile } from "./governor-tile";

const listFmt = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

export function GovernorsBoard({ metas, states, photos, ratings }: { metas: RaceMeta[]; states: Pick<StateMeta, "abbr" | "name">[]; photos?: PhotoMap; ratings?: ReactNode }) {
  const mounted = useMounted();
  const { data } = useNational();

  const live: LiveIndex = useMemo(() => (mounted && data?.races?.length ? indexRaces(data) : EMPTY_LIVE), [mounted, data]);
  const bop = useMemo(() => buildBalance("governor", metas, live), [metas, live]);
  const stateName = useMemo(() => stateNameLookup(states), [states]);
  const announcement = useCallAnnouncer("Governor", metas, live, stateName);

  const held = useMemo(() => {
    const h = { D: 0, R: 0, I: 0 };
    for (const m of metas) if (m.heldBy) h[m.heldBy === "D" || m.heldBy === "R" ? m.heldBy : "I"] += 1;
    return h;
  }, [metas]);

  const flips = useMemo(
    () =>
      metas
        .map((m) => ({ meta: m, to: flippedTo(m, live.get(m.id)) }))
        .filter((f): f is { meta: RaceMeta; to: Party } => !!f.to)
        .sort((a, b) => stateName(a.meta.state).localeCompare(stateName(b.meta.state))),
    [metas, live, stateName],
  );
  const net = flips.filter((f) => f.to === "D").length - flips.filter((f) => f.to === "R").length;
  const anyCalled = bop.called.D + bop.called.R + bop.called.I > 0;
  const runoffs = metas.filter((m) => m.runoffRule === "majority").map((m) => stateName(m.state));

  const sorted = useMemo(() => [...metas].sort((a, b) => a.state.localeCompare(b.state)), [metas]);

  return (
    <div className="space-y-12">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <header className="page-header">
        <h1 className="page-title">Governors</h1>
        <p className="page-lede">
          {metas.length} governorships are on the ballot, {held.D} held by Democrats and {held.R} by Republicans
          {held.I ? ` and ${held.I} by independents` : ""}.
          {runoffs.length ? ` ${listFmt.format(runoffs)} ${runoffs.length === 1 ? "goes" : "go"} to a runoff if no one wins a majority.` : ""}
        </p>
      </header>

      <section aria-labelledby="gov-balance" className="space-y-4">
        <h2 id="gov-balance" className="section-title">
          Balance of power
        </h2>
        <Card>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6">
              <HeroCount party="D" total={bop.called.D + bop.leaning.D} label="Democrats" />
              <HeroCount party="R" total={bop.called.R + bop.leaning.R} label="Republicans" right />
            </div>

            <div className="mt-6">
              {anyCalled ? (
                <BalanceBar bop={bop} height={16} showMajorityTick={false} />
              ) : (
                <SeatBar d={bop.leaning.D} r={bop.leaning.R} total={bop.total} />
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
              <Standing party="D" won={bop.called.D} leaning={bop.leaning.D} held={held.D} up={metas.length} anyCalled={anyCalled} />
              <Standing party="R" won={bop.called.R} leaning={bop.leaning.R} held={held.R} up={metas.length} anyCalled={anyCalled} right />
            </div>

            {flips.length > 0 && (
              <p className="mt-4 text-[15px]">
                <b className={cn(partyInk(net > 0 ? "D" : net < 0 ? "R" : undefined))}>
                  {net === 0 ? "Flips even so far" : `Net ${net > 0 ? "Democratic" : "Republican"} gain of ${Math.abs(net)}`}:
                </b>{" "}
                {flips.map((f, i) => (
                  <span key={f.meta.id}>
                    {i > 0 && ", "}
                    <span className={partyInk(f.to)}>
                      {stateName(f.meta.state)} to {f.to}
                    </span>
                  </span>
                ))}
              </p>
            )}

            <p className="mt-5 text-xs text-muted-foreground text-pretty">
              Each total is {anyCalled ? "races won plus " : ""}uncalled races rated toward that side; {bop.tossup} toss-up
              {bop.tossup === 1 ? " is" : "s are"} left out. Governorships not on the ballot this year are not counted.
            </p>
          </CardContent>
        </Card>
      </section>

      {ratings}

      <section aria-labelledby="gov-tiles" className="space-y-4">
        <h2 id="gov-tiles" className="section-title">
          State by state
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {sorted.map((m) => (
            <GovernorTile key={m.id} meta={m} race={live.get(m.id)} stateName={stateName(m.state)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="gov-races" className="space-y-4">
        <h2 id="gov-races" className="section-title">
          All {metas.length} races
        </h2>
        <RaceTable office="governor" metas={metas} live={live} states={states} photos={photos} />
      </section>

      {live.size > 0 && data?.notices?.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {data.notices.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One sentence per side: where the ratings put it against the seats it holds now, or what it has won so far. */
function Standing({
  party,
  won,
  leaning,
  held,
  up,
  anyCalled,
  right,
}: {
  party: "D" | "R";
  won: number;
  leaning: number;
  held: number;
  up: number;
  anyCalled: boolean;
  right?: boolean;
}) {
  const who = party === "D" ? "Democrats" : "Republicans";
  const ink = party === "D" ? "text-party-d-ink" : "text-party-r-ink";
  return (
    <p className={cn("text-pretty tnum", right && "sm:text-right")}>
      {anyCalled ? (
        <>
          <b className={ink}>
            {who} have won {won}
          </b>
          {leaning ? ` and are favoured in ${leaning} more` : ""}. They held {held} going in.
        </>
      ) : (
        <>
          <b className={ink}>
            Ratings favour {who} in {leaning}
          </b>{" "}
          of {up} races. They hold {held} of these seats now.
        </>
      )}
    </p>
  );
}
