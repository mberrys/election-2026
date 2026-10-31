"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { useNational, indexRaces } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { HouseProjectionAnnouncer } from "@/components/house/projection-announcer";
import { ChamberGrid } from "./chamber-grid";
import { BallotMeasures } from "./ballot-measures";
import type { LiveRace } from "./states-lib";

export function StatesBoard({ legs, measures, governors, states }: { legs: RaceMeta[]; measures: RaceMeta[]; governors: RaceMeta[]; states: StateMeta[] }) {
  const mounted = useMounted();
  const { data } = useNational();
  const payload = mounted ? data : undefined;
  const live = useMemo(() => indexRaces(payload) as Map<string, LiveRace>, [payload]);
  const stateNames = useMemo(() => new Map(states.map((s) => [s.abbr, s.name])), [states]);

  return (
    <div className="space-y-5">
      <HouseProjectionAnnouncer />
      <ChamberGrid legs={legs} governors={governors} live={live} stateNames={stateNames} />
      <BallotMeasures measures={measures} live={live} stateNames={stateNames} />
      <p className="text-[11px] text-muted-foreground">
        Chamber compositions, candidates, ratings and measure summaries: Wikipedia, CC BY-SA 4.0. Measure texts and status: Ballotpedia (link-outs).
        Live counts come from official state and county feeds where available; see{" "}
        <Link href="/methodology" className="underline-offset-2 hover:underline">
          methodology
        </Link>
        .
      </p>
    </div>
  );
}
