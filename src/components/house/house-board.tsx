"use client";

import { raceHref } from "@/lib/race-slug";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { useNational, indexRaces } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { HexCartogram, HEXMAP_ATTRIBUTION } from "@/components/maps/hex-cartogram";
import { BalanceBar } from "@/components/board/balance-bar";
import { RaceCard } from "@/components/board/race-card";
import { Num } from "@/components/board/num";
import { Swatch } from "@/components/board/hatch";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GenericBallotPanel, type GenericBallotData } from "./generic-ballot";
import { PollCloseWatch } from "./poll-close-watch";
import { HouseTable } from "./house-table";
import { HouseProjectionAnnouncer } from "./projection-announcer";
import {
  HOUSE_FILTERS,
  HOUSE_MAJORITY,
  MAP_MODES,
  availableModes,
  baselineMargin,
  houseHasVotes,
  legendKeys,
  liveMarginDR,
  matchesFilter,
  shortDistrict,
  summarizeHouse,
  swingDR,
  tileFill,
  tileMark,
  type HouseFilter,
  type LegendKey,
  type LiveRace,
  type MapMode,
} from "./house-lib";

const ALL_STATES = "ALL";

export function HouseBoard({ metas, states, generic }: { metas: RaceMeta[]; states: StateMeta[]; generic?: GenericBallotData }) {
  const mounted = useMounted();
  const { data } = useNational();
  // Server render and first client paint both see "no live data"; the browser cache (if warm) applies right after mount.
  const payload = mounted ? data : undefined;
  const live = useMemo(() => indexRaces(payload) as Map<string, LiveRace>, [payload]);
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas]);
  const hasVotes = useMemo(() => houseHasVotes(live), [live]);

  // Before any vote only the ratings view has anything to draw; once votes arrive the status view leads.
  const modes = availableModes(hasVotes);
  const [modeChoice, setMode] = useState<MapMode | null>(null);
  const mode: MapMode = modeChoice && modes.includes(modeChoice) ? modeChoice : hasVotes ? "status" : "ratings";
  const [filter, setFilter] = useState<HouseFilter>("all");
  const [stateFilter, setStateFilter] = useState<string>(ALL_STATES);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const summary = useMemo(() => summarizeHouse(metas, live), [metas, live]);
  const st = stateFilter === ALL_STATES ? null : stateFilter;
  const filtering = filter !== "all" || st != null;

  const matches = useCallback((id: string) => matchesFilter(filter, st, live.get(id), metaById.get(id)), [filter, st, live, metaById]);
  const filteredMetas = useMemo(() => (filtering ? metas.filter((m) => matches(m.id)) : metas), [metas, filtering, matches]);
  const legend = useMemo(() => legendKeys(mode, metas, live), [mode, metas, live]);

  const fill = useCallback((id: string) => tileFill(mode, live.get(id), metaById.get(id)), [mode, live, metaById]);
  const mark = useCallback((id: string) => tileMark(mode, live.get(id), metaById.get(id)), [mode, live, metaById]);
  const label = useCallback(
    (id: string) => {
      const m = metaById.get(id);
      const lr = live.get(id);
      const parts = [m?.name ?? shortDistrict(id)];
      if (lr?.projection) parts.push(`Projected ${lr.projection.party}`);
      const margin = liveMarginDR(lr);
      if (margin != null) parts.push(`now ${fmtMarginDR(margin)}`);
      if (mode === "swing") {
        const s = swingDR(lr, m);
        if (s != null) parts.push(`swing ${fmtMarginDR(s)} vs 2024 (${fmtMarginDR(baselineMargin(m))})`);
      }
      return parts.join(" · ");
    },
    [metaById, live, mode],
  );

  const focusId = pinned ?? hover;
  const focusMeta = focusId ? metaById.get(focusId) : undefined;
  const focusLive = focusId ? live.get(focusId) : undefined;
  const pin = (id: string) => setPinned((p) => (p === id ? null : id));

  const stateOptions = useMemo(
    () => [{ value: ALL_STATES, label: "All states" }, ...states.filter((s) => s.abbr !== "DC").map((s) => ({ value: s.abbr, label: s.name }))],
    [states],
  );
  const clearFilters = () => {
    setFilter("all");
    setStateFilter(ALL_STATES);
  };

  const mapTitle = useId();
  const tableTitle = useId();

  return (
    <div className="space-y-12">
      <HouseProjectionAnnouncer />

      {/* ---- Balance of power ---- */}
      <Card size="sm" aria-label="Balance of power">
        <CardContent className="space-y-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
            <BigCount n={summary.dTotal} called={summary.bop.called.D} net={summary.netD} label="Democrats" className="text-party-d-ink" />
            <div className="pb-0.5 text-center leading-tight">
              <div className="text-xl font-bold tnum">{HOUSE_MAJORITY}</div>
              <div className="text-xs text-muted-foreground">for control</div>
            </div>
            <BigCount n={summary.rTotal} called={summary.bop.called.R} net={summary.netR} label="Republicans" className="text-party-r-ink" right />
          </div>
          <BalanceBar bop={summary.bop} height={20} className="mt-7" />
          <p className="text-sm text-muted-foreground">
            {summary.calledCount > 0 ? (
              <>
                <span className="tnum">{summary.calledCount}</span> of 435 seats projected by Big Board. Uncalled seats count toward the party their rating
                leans to; <span className="tnum">{summary.tossup}</span> toss-ups are unassigned.
              </>
            ) : (
              <>
                Seats are counted by consensus rating until votes are in; <span className="tnum">{summary.tossup}</span> toss-ups are unassigned.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ---- Cartogram + generic ballot ---- */}
      <section aria-labelledby={mapTitle} className="space-y-5">
        <div className="space-y-1.5">
          <h2 id={mapTitle} className="section-title">
            District map
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasVotes ? "Each shape is one district." : "Each shape is one district, coloured by its consensus rating."} Hover or tab to a district for its
            race card; click or press Enter to pin it.
          </p>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card size="sm" className="min-w-0">
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {modes.length > 1 && (
                  <ToggleGroup
                    value={[mode]}
                    onValueChange={(v) => v[0] && setMode(v[0] as MapMode)}
                    variant="outline"
                    size="sm"
                    spacing={0}
                    aria-label="Map colouring"
                  >
                    {MAP_MODES.filter((m) => modes.includes(m.value)).map((m) => (
                      <ToggleGroupItem key={m.value} value={m.value} aria-label={m.label}>
                        {m.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
                <div className={cn("flex flex-wrap items-center gap-2", modes.length > 1 && "xl:ml-auto")}>
                  <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as HouseFilter)} size="sm" aria-label="Filter districts">
                    {HOUSE_FILTERS.map((f) => (
                      <ToggleGroupItem key={f.value} value={f.value} className="rounded-full">
                        {f.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Select value={stateFilter} onValueChange={(v) => setStateFilter((v as string | null) ?? ALL_STATES)} items={stateOptions}>
                    <SelectTrigger size="sm" className="min-w-36" aria-label="Filter by state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stateOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <HexCartogram
                fill={fill}
                mark={mark}
                label={label}
                onHover={setHover}
                onSelect={pin}
                selected={pinned}
                highlight={filtering ? matches : undefined}
                showLabels
              />

              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <Legend keys={legend} />
                {filtering && (
                  <span className="tnum">
                    {filteredMetas.length} of {metas.length} districts match
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <GenericBallotPanel generic={generic} />
        </div>
      </section>

      {/* ---- Floating race card ---- */}
      {focusId && (
        <div
          className={cn(
            "pointer-events-none fixed right-2 bottom-2 z-30 w-[min(22rem,calc(100vw-1rem))] md:right-4 md:bottom-4",
            pinned && "pointer-events-auto",
          )}
          role="complementary"
          aria-label="Selected district"
        >
          <div className="relative">
            {pinned && (
              <Button
                variant="outline"
                size="icon-xs"
                className="absolute -top-2 -right-2 z-10 rounded-full bg-background"
                onClick={() => setPinned(null)}
                aria-label="Unpin district"
              >
                <XIcon />
              </Button>
            )}
            <RaceCard live={focusLive} meta={focusMeta} href={pinned && focusMeta ? raceHref(focusMeta.id) : undefined} className="bg-popover shadow-xl" />
            {focusMeta && <FocusFacts meta={focusMeta} />}
          </div>
        </div>
      )}

      {/* ---- Poll-close watch ---- */}
      <PollCloseWatch metas={metas} states={states} live={live} onSelect={pin} selected={pinned} />

      {/* ---- Table ---- */}
      <section aria-labelledby={tableTitle} className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={tableTitle} className="section-title">
            All districts
          </h2>
          {filtering && (
            <button type="button" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        <Card size="sm">
          <CardContent>
            <HouseTable metas={filteredMetas} live={live} hasVotes={hasVotes} selected={pinned} onSelect={pin} />
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        Candidates and ratings: Wikipedia (CC BY-SA 4.0); the consensus rating is the median of Cook, Inside Elections and Sabato. 2024 margins: presidential
        result on 2026 district lines. Vote counts: official state and county feeds, see{" "}
        <Link href="/methodology" className="underline-offset-2 hover:underline">
          methodology
        </Link>
        . {HEXMAP_ATTRIBUTION}.
      </p>
    </div>
  );
}

function BigCount({ n, called, net, label, className, right }: { n: number; called: number; net: number; label: string; className?: string; right?: boolean }) {
  return (
    <div className={cn("leading-none", right && "text-right")}>
      <div
        className={cn("display text-5xl font-bold tnum md:text-6xl", className)}
        title={`${net > 0 ? "+" : ""}${net} seats vs those held going into the election (projected + leaning)`}
      >
        <Num value={n} />
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        {label}
        {called > 0 && (
          <>
            {" · "}
            <span className="tnum text-foreground">{called}</span> projected
          </>
        )}
      </div>
    </div>
  );
}

/** One muted line under the floating race card: only the facts this district has. */
function FocusFacts({ meta }: { meta: RaceMeta }) {
  const facts = [
    meta.baseline.presMargin2024 != null && `2024 president ${fmtMarginDR(meta.baseline.presMargin2024)}`,
    meta.baseline.prevRaceMargin != null && `Last House race ${fmtMarginDR(meta.baseline.prevRaceMargin)}`,
    meta.heldBy && `Held by ${meta.heldBy}`,
  ].filter(Boolean) as string[];
  if (!facts.length) return null;
  return (
    <div className="mt-1 flex flex-wrap justify-between gap-x-3 rounded-md bg-popover/95 px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-foreground/10 tnum">
      {facts.map((f) => (
        <span key={f}>{f}</span>
      ))}
    </div>
  );
}

/** Keys for the marks currently drawn, nothing more. */
function Legend({ keys }: { keys: LegendKey[] }) {
  if (!keys.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Map key">
      {keys.map((k) => (
        <li key={k.label} className="inline-flex items-center gap-1.5">
          {k.kind === "swatch" ? (
            <Swatch kind={k.swatch} />
          ) : k.kind === "fill" ? (
            <i aria-hidden className="inline-block h-3.5 w-3.5 shrink-0 rounded-[2px]" style={{ background: k.fill }} />
          ) : (
            <i aria-hidden className="inline-block h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-foreground" />
          )}
          {k.label}
        </li>
      ))}
    </ul>
  );
}
