"use client";

import { useMemo } from "react";
import { SENATE_NOT_UP_2026 } from "@/analytics";
import { indexRaces, useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { buildBalance, EMPTY_LIVE, stateNameLookup, type LiveIndex } from "./balance";
import { ChamberBalance } from "./chamber-balance";
import { PathToMajority } from "./path-to-majority";
import { RaceTable } from "./race-table";
import { useCallAnnouncer } from "./use-call-announcer";

/**
 * Senate page body. Server passes reference metas + states; live results come from the shared
 * national poll. Before mount (SSR + hydration) the board renders from metas alone, so there is no
 * skeleton flash and no hydration mismatch when the browser cache already holds a snapshot.
 */
export function SenateBoard({ metas, states }: { metas: RaceMeta[]; states: Pick<StateMeta, "abbr" | "name" | "tier">[] }) {
  const mounted = useMounted();
  const { data } = useNational();

  const live: LiveIndex = useMemo(() => (mounted && data?.races?.length ? indexRaces(data) : EMPTY_LIVE), [mounted, data]);
  const bop = useMemo(() => buildBalance("senate", metas, live, SENATE_NOT_UP_2026), [metas, live]);
  const stateName = useMemo(() => stateNameLookup(states), [states]);
  const announcement = useCallAnnouncer("Senate", metas, live, stateName);

  return (
    <div className="space-y-6">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">Senate</h1>
        <p className="text-sm text-muted-foreground">
          {metas.length} seats on the ballot · specials in {metas.filter((m) => m.special).map((m) => m.state).join(", ")} · Georgia requires
          a majority or goes to a runoff
        </p>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <ChamberBalance bop={bop} className="xl:col-span-3" />
        <PathToMajority bop={bop} metas={metas} live={live} stateName={stateName} className="xl:col-span-2" />
      </div>

      <section aria-labelledby="senate-races">
        <h2 id="senate-races" className="display mb-3 text-xl font-semibold">
          All {metas.length} races
        </h2>
        <RaceTable office="senate" metas={metas} live={live} states={states} />
      </section>

      {mounted && data?.notices?.length ? (
        <ul className="space-y-1 text-xs text-stale">
          {data.notices.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
