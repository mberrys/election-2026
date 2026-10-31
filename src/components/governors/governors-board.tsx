"use client";

import { useMemo } from "react";
import { indexRaces, useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { BalanceBar } from "@/components/board/balance-bar";
import { Num } from "@/components/board/num";
import { Card, CardContent } from "@/components/ui/card";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { cn } from "@/lib/utils";
import { buildBalance, EMPTY_LIVE, flippedTo, stateNameLookup, type LiveIndex } from "@/components/senate/balance";
import { RaceTable } from "@/components/senate/race-table";
import { useCallAnnouncer } from "@/components/senate/use-call-announcer";
import { GovernorTile } from "./governor-tile";

export function GovernorsBoard({ metas, states }: { metas: RaceMeta[]; states: Pick<StateMeta, "abbr" | "name" | "tier">[] }) {
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
        .filter((f): f is { meta: RaceMeta; to: "D" | "R" | "I" | "L" | "G" | "O" } => !!f.to),
    [metas, live],
  );
  const flipsD = flips.filter((f) => f.to === "D");
  const flipsR = flips.filter((f) => f.to === "R");
  const calledTotal = bop.called.D + bop.called.R + bop.called.I;

  const sorted = useMemo(() => [...metas].sort((a, b) => a.state.localeCompare(b.state)), [metas]);

  return (
    <div className="space-y-6">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="display text-3xl font-bold tracking-tight">Governors</h1>
        <p className="text-sm text-muted-foreground">{metas.length} governorships on the ballot · Georgia requires a majority or goes to a runoff</p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Stat
              party="D"
              big={bop.called.D + bop.leaning.D}
              bigLabel="Dem (won + leaning)"
              sub={[
                [held.D, "held going in"],
                [bop.called.D, "won"],
                [flipsD.length, "flipped in"],
              ]}
            />
            <div className="text-center text-xs text-muted-foreground tnum">
              <div className="display text-base font-semibold text-foreground tracking-wide">36 SEATS UP</div>
              <div>
                {calledTotal} called · {bop.tossup} toss-up{bop.tossup === 1 ? "" : "s"}
              </div>
              <div>
                Net so far:{" "}
                <span className={cn("font-semibold", flipsD.length > flipsR.length && "text-party-d", flipsR.length > flipsD.length && "text-party-r")}>
                  {flipsD.length === flipsR.length ? "even" : flipsD.length > flipsR.length ? `D +${flipsD.length - flipsR.length}` : `R +${flipsR.length - flipsD.length}`}
                </span>
              </div>
            </div>
            <Stat
              party="R"
              big={bop.called.R + bop.leaning.R}
              bigLabel="GOP (won + leaning)"
              sub={[
                [held.R, "held going in"],
                [bop.called.R, "won"],
                [flipsR.length, "flipped in"],
              ]}
              right
            />
          </div>
          <div className="mt-5">
            <BalanceBar bop={bop} height={16} showMajorityTick={false} />
          </div>
          {flips.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Flips so far:{" "}
              {flips.map((f, i) => (
                <span key={f.meta.id}>
                  {i > 0 && ", "}
                  <span className={f.to === "D" ? "text-party-d" : f.to === "R" ? "text-party-r" : "text-party-i"}>
                    {f.meta.state} {f.meta.heldBy}→{f.to}
                  </span>
                </span>
              ))}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Of the {metas.length} seats up, {held.D} are held by Democrats and {held.R} by Republicans{held.I ? ` and ${held.I} by independents` : ""}. Totals
            count projected wins plus uncalled seats by consensus rating; governorships not on the ballot are excluded.
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="gov-tiles">
        <h2 id="gov-tiles" className="display mb-3 text-xl font-semibold">
          The map, as tiles
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-9">
          {sorted.map((m) => (
            <GovernorTile key={m.id} meta={m} race={live.get(m.id)} stateName={stateName(m.state)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="gov-races">
        <h2 id="gov-races" className="display mb-3 text-xl font-semibold">
          All {metas.length} races
        </h2>
        <RaceTable office="governor" metas={metas} live={live} states={states} />
      </section>

      {mounted && data?.notices?.length ? (
        <ul className="space-y-1 text-xs text-stale">
          {data.notices.map((n, i) => (
            <li key={i}>⚠ {n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Stat({
  party,
  big,
  bigLabel,
  sub,
  right,
}: {
  party: "D" | "R";
  big: number;
  bigLabel: string;
  sub: [number, string][];
  right?: boolean;
}) {
  const color = party === "D" ? "text-party-d" : "text-party-r";
  return (
    <div className={cn(right && "sm:text-right")}>
      <div className={cn("display tnum text-6xl font-bold leading-none", color)}>
        <Num value={big} />
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{bigLabel}</div>
      <div className={cn("mt-2 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground tnum", right && "sm:justify-end")}>
        {sub.map(([n, l]) => (
          <span key={l}>
            <b className="text-foreground">{n}</b> {l}
          </span>
        ))}
      </div>
    </div>
  );
}
