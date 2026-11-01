"use client";

import type { ReactNode } from "react";

import { useMemo } from "react";
import { SENATE_NOT_UP_2026 } from "@/analytics";
import { indexRaces, useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import type { PhotoMap } from "@/data/reference/images";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { buildBalance, EMPTY_LIVE, stateNameLookup, type LiveIndex } from "./balance";
import { ChamberBalance } from "./chamber-balance";
import { PathToMajority } from "./path-to-majority";
import { RaceTable } from "./race-table";
import { useCallAnnouncer } from "./use-call-announcer";

const listFmt = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

/**
 * Senate page body. Server passes reference metas + states; live results come from the shared
 * national poll. Before mount (SSR + hydration) the board renders from metas alone, so there is no
 * skeleton flash and no hydration mismatch when the browser cache already holds a snapshot.
 */
export function SenateBoard({ metas, states, photos, ratings }: { metas: RaceMeta[]; states: Pick<StateMeta, "abbr" | "name">[]; photos?: PhotoMap; ratings?: ReactNode }) {
  const mounted = useMounted();
  const { data } = useNational();

  const live: LiveIndex = useMemo(() => (mounted && data?.races?.length ? indexRaces(data) : EMPTY_LIVE), [mounted, data]);
  const bop = useMemo(() => buildBalance("senate", metas, live, SENATE_NOT_UP_2026), [metas, live]);
  const stateName = useMemo(() => stateNameLookup(states), [states]);
  const announcement = useCallAnnouncer("Senate", metas, live, stateName);

  const specials = metas.filter((m) => m.special).map((m) => stateName(m.state));
  const runoffs = metas.filter((m) => m.runoffRule === "majority").map((m) => stateName(m.state));

  return (
    <div className="space-y-12">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <header className="page-header">
        <h1 className="page-title">Senate</h1>
        <p className="page-lede">
          {metas.length} seats are on the ballot{specials.length ? `, including special elections in ${listFmt.format(specials)}` : ""}.
          {runoffs.length ? ` ${listFmt.format(runoffs)} ${runoffs.length === 1 ? "goes" : "go"} to a runoff if no one wins a majority.` : ""}
        </p>
      </header>

      <section aria-labelledby="senate-balance" className="space-y-4">
        <h2 id="senate-balance" className="section-title">
          Balance of power
        </h2>
        <div className="grid items-start gap-4 xl:grid-cols-5">
          <ChamberBalance bop={bop} className="xl:col-span-3" />
          <PathToMajority bop={bop} metas={metas} live={live} stateName={stateName} className="xl:col-span-2" />
        </div>
      </section>

      {ratings}

      <section aria-labelledby="senate-races" className="space-y-4">
        <h2 id="senate-races" className="section-title">
          All {metas.length} races
        </h2>
        <RaceTable office="senate" metas={metas} live={live} states={states} photos={photos} />
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
