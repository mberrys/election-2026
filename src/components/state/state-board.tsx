"use client";

import { useMemo, useState } from "react";
import type { Race, RaceMeta, StateMeta, Tier } from "@/data/schema";
import { useStateResults } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bellwethers } from "./bellwethers";
import { CountyMapPanel, type MapMode } from "./county-map-panel";
import { CountyTable } from "./county-table";
import {
  TIER_SOURCE_LABEL,
  buildCountyRows,
  groupRaces,
  pickDefaultRace,
  stateBaselineFromCounties,
  type CountyBaselines,
} from "./derive";
import { HouseStrip } from "./house-strip";
import { RaceSelector } from "./race-selector";
import { StateHeader } from "./state-header";
import { TopLine } from "./top-line";
import { WhatsLeft } from "./whats-left";

export interface StateBoardProps {
  state: StateMeta;
  metas: RaceMeta[];
  /** County baselines for this state only, keyed by 5-digit fips. */
  counties: CountyBaselines;
}

const EMPTY_LIVE: ReadonlyMap<string, Race> = new Map();

/**
 * The Kornacki screen for one state. Everything below the header is driven by the selected race; with no live feed
 * every panel renders from reference metas and county baselines.
 */
export function StateBoard({ state, metas, counties }: StateBoardProps) {
  const mounted = useMounted();
  const { data, isPending, isError } = useStateResults(state.abbr);

  const live = useMemo<ReadonlyMap<string, Race>>(() => {
    if (!data?.races?.length) return EMPTY_LIVE;
    return new Map(data.races.map((r) => [r.id, r]));
  }, [data]);

  const [selectedId, setSelectedId] = useState<string | undefined>(() => pickDefaultRace(metas));
  const selectedMeta = useMemo(() => metas.find((m) => m.id === selectedId), [metas, selectedId]);
  const selectedLive = selectedId ? live.get(selectedId) : undefined;

  const rows = useMemo(() => buildCountyRows(selectedLive, selectedMeta, counties), [selectedLive, selectedMeta, counties]);

  const stateBaseline = useMemo(() => {
    const statewide = metas.find((m) => m.office === "senate" || m.office === "governor");
    if (statewide?.baseline.presMargin2024 != null)
      return { margin2024: statewide.baseline.presMargin2024, margin2020: statewide.baseline.presMargin2020 };
    return stateBaselineFromCounties(counties);
  }, [metas, counties]);

  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("margin");
  // Switching races also drops the pinned county; it may not exist in the new unit set.
  const selectRace = (id: string) => {
    setSelectedId(id);
    setSelectedFips(null);
  };

  const groups = useMemo(() => groupRaces(metas), [metas]);
  const tier: Tier | undefined = state.tier ?? selectedLive?.source.tier ?? data?.races?.[0]?.source.tier;

  const settled = mounted && !isPending;
  const noFeed = settled && (isError || !data?.races?.length);

  const announcement = useProjectionAnnouncements(data?.races, state.name);

  return (
    <div className="space-y-6">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <StateHeader state={state} tier={tier} race={selectedLive} generatedAt={data?.generatedAt ?? null} raceCount={metas.length} />

      {noFeed && (
        <Card className="border-dashed px-4 py-3 text-sm text-muted-foreground" role="status">
          <p>
            <span className="font-medium text-foreground">No live feed yet</span> —{" "}
            {tier
              ? `this state's results come from ${TIER_SOURCE_LABEL[tier]}${state.feeds.length ? ` (${state.feeds.join(", ")})` : ""}.`
              : "no automated source is configured for this state yet; the board below is built from reference data and 2024 county baselines."}
            {isError && " The results endpoint is currently unreachable; retrying automatically."}
          </p>
        </Card>
      )}

      <RaceSelector metas={metas} live={live} value={selectedId} onChange={selectRace} />

      {selectedId && <TopLine race={selectedLive} meta={selectedMeta} />}

      <section className="grid gap-4 lg:grid-cols-12" aria-label="County detail">
        <Card className="gap-3 p-4 lg:col-span-5">
          <SectionLabel>County map</SectionLabel>
          <CountyMapPanel
            stateFips={state.fips}
            rows={rows}
            selected={selectedFips}
            onSelect={setSelectedFips}
            mode={mapMode}
            onModeChange={setMapMode}
          />
        </Card>
        <Card className="gap-3 p-4 lg:col-span-7">
          <SectionLabel>
            Counties <span className="tnum normal-case tracking-normal text-muted-foreground/80">({rows.length})</span>
          </SectionLabel>
          <CountyTable rows={rows} selected={selectedFips} onSelect={setSelectedFips} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-12" aria-label="Outstanding vote and bellwethers">
        <Card className="gap-3 p-4 lg:col-span-5">
          <SectionLabel>What&apos;s left</SectionLabel>
          <WhatsLeft rows={rows} selected={selectedFips} onSelect={setSelectedFips} />
        </Card>
        <Card className="gap-3 p-4 lg:col-span-7">
          <SectionLabel>
            Bellwether watchlist{" "}
            <span className="normal-case tracking-normal text-muted-foreground/80">— counties that tracked the state in 2020 &amp; 2024</span>
          </SectionLabel>
          <Bellwethers
            rows={rows}
            stateBaseline={stateBaseline}
            stateMarginNow={selectedLive?.marginDR}
            selected={selectedFips}
            onSelect={setSelectedFips}
          />
        </Card>
      </section>

      {groups.house.length > 0 && (
        <section aria-label="House districts" className="space-y-3">
          <SectionLabel>
            House districts <span className="tnum normal-case tracking-normal text-muted-foreground/80">({groups.house.length})</span>
          </SectionLabel>
          <HouseStrip metas={groups.house} live={live} selectedId={selectedId} onSelect={selectRace} />
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground", className)}>{children}</h2>;
}

interface AnnounceState {
  races: Race[] | undefined;
  seen: ReadonlyMap<string, string>;
  text: string;
}

/**
 * Text for the polite live region: changes only when a race in this state gains or changes a projection.
 * Derived during render from the previous snapshot (no effect); the first snapshot seeds silently so page load
 * does not read out every existing call.
 */
function useProjectionAnnouncements(races: Race[] | undefined, stateName: string): string {
  const [st, setSt] = useState<AnnounceState>({ races: undefined, seen: new Map(), text: "" });
  if (races !== st.races) {
    const first = st.races === undefined;
    const seen = new Map(st.seen);
    const msgs: string[] = [];
    for (const r of races ?? []) {
      const w = r.projection?.winnerId;
      if (!w || seen.get(r.id) === w) continue;
      seen.set(r.id, w);
      if (first) continue;
      const cand = r.candidates.find((c) => c.id === w);
      msgs.push(`${stateName}: Big Board projects ${cand?.name ?? w} (${r.projection?.party}) in ${r.name}.`);
    }
    setSt({ races, seen, text: msgs.length ? msgs.join(" ") : st.text });
  }
  return st.text;
}
