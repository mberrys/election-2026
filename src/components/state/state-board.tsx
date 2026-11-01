"use client";

import { useId, useMemo, useState } from "react";
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
  const hasVotes = rows.some((r) => r.votesIn > 0);

  const settled = mounted && !isPending;
  const noFeed = settled && (isError || !data?.races?.length);
  const sourceNote = !noFeed
    ? undefined
    : isError
      ? "The results feed is unreachable right now; we retry automatically."
      : tier
        ? `Results will come from the ${TIER_SOURCE_LABEL[tier]}.`
        : "No automated results source is set up for this state yet; the board uses reference data and 2024 county baselines.";

  const announcement = useProjectionAnnouncements(data?.races, state.name);

  return (
    <div className="space-y-12">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <div className="space-y-8">
        <StateHeader state={state} race={selectedLive} generatedAt={data?.generatedAt ?? null} raceCount={metas.length} sourceNote={sourceNote} />
        <RaceSelector metas={metas} live={live} value={selectedId} onChange={selectRace} />
      </div>

      {selectedId && <TopLine race={selectedLive} meta={selectedMeta} />}

      <Section
        title="Counties"
        count={rows.length}
        description={
          hasVotes
            ? "Hover a county for its numbers; click a county on the map or in the table to pin it."
            : "Coloured by the 2024 presidential margin until votes are counted. Click a county to pin it in the table."
        }
      >
        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* The map gets the wide side until votes arrive; then the table needs it for its live columns. */}
          <Card className={cn("p-4", hasVotes ? "lg:col-span-5" : "lg:col-span-7")}>
            <CountyMapPanel
              stateFips={state.fips}
              rows={rows}
              selected={selectedFips}
              onSelect={setSelectedFips}
              mode={mapMode}
              onModeChange={setMapMode}
              hasVotes={hasVotes}
            />
          </Card>
          <CountyTable rows={rows} selected={selectedFips} onSelect={setSelectedFips} hasVotes={hasVotes} className={cn("bg-card", hasVotes ? "lg:col-span-7" : "lg:col-span-5")} />
        </div>
      </Section>

      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-6">
        <Section title={hasVotes ? "What’s left" : "Where the vote is"} className="lg:col-span-5">
          <WhatsLeft rows={rows} hasVotes={hasVotes} selected={selectedFips} onSelect={setSelectedFips} />
        </Section>
        <Section
          title="Bellwether counties"
          description="Counties whose 2020 and 2024 margins tracked the statewide result most closely."
          className="lg:col-span-7"
        >
          <Bellwethers
            rows={rows}
            stateBaseline={stateBaseline}
            stateMarginNow={selectedLive?.marginDR}
            selected={selectedFips}
            onSelect={setSelectedFips}
          />
        </Section>
      </div>

      {groups.house.length > 0 && (
        <Section title="House districts" count={groups.house.length} description="Select a district to load it at the top of the page.">
          <HouseStrip metas={groups.house} live={live} selectedId={selectedId} onSelect={selectRace} />
        </Section>
      )}
    </div>
  );
}

/** A page section: 24px heading, optional count and one-line description, content 20px below. */
function Section({
  title,
  count,
  description,
  className,
  children,
}: {
  title: string;
  count?: number;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("space-y-5", className)}>
      <div className="space-y-1.5">
        <h2 id={id} className="section-title">
          {title}
          {count != null && <span className="ml-2 font-semibold text-muted-foreground tnum">{count}</span>}
        </h2>
        {description && <p className="max-w-[68ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
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
