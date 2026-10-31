"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { useNational, indexRaces } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { HexCartogram, HEXMAP_ATTRIBUTION } from "@/components/maps/hex-cartogram";
import { BalanceBar } from "@/components/board/balance-bar";
import { RaceCard } from "@/components/board/race-card";
import { Num } from "@/components/board/num";
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
  MAP_MODES,
  baselineMargin,
  liveMarginDR,
  matchesFilter,
  shortDistrict,
  summarizeHouse,
  swingDR,
  tileFill,
  type HouseFilter,
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

  const [mode, setMode] = useState<MapMode>("status");
  const [filter, setFilter] = useState<HouseFilter>("all");
  const [stateFilter, setStateFilter] = useState<string>(ALL_STATES);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const summary = useMemo(() => summarizeHouse(metas, live), [metas, live]);
  const st = stateFilter === ALL_STATES ? null : stateFilter;
  const filtering = filter !== "all" || st != null;

  const matches = useCallback((id: string) => matchesFilter(filter, st, live.get(id), metaById.get(id)), [filter, st, live, metaById]);
  const filteredMetas = useMemo(() => (filtering ? metas.filter((m) => matches(m.id)) : metas), [metas, filtering, matches]);

  const fill = useCallback((id: string) => tileFill(mode, live.get(id), metaById.get(id)), [mode, live, metaById]);
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

  const stateOptions = useMemo(
    () => [{ value: ALL_STATES, label: "All states" }, ...states.filter((s) => s.abbr !== "DC").map((s) => ({ value: s.abbr, label: s.name }))],
    [states],
  );

  return (
    <div className="space-y-5">
      <HouseProjectionAnnouncer />

      {/* ---- Header strip ---- */}
      <Card size="sm">
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <BigCount n={summary.dTotal} called={summary.bop.called.D} net={summary.netD} label="Dem" className="text-party-d-ink" />
            <div className="text-center text-[11px] text-muted-foreground leading-tight">
              <div className="display text-lg text-foreground tnum">218 to control</div>
              <div className="tnum">
                <Num value={summary.tossup} /> toss-ups · <Num value={summary.calledCount} /> of 435 called
              </div>
            </div>
            <BigCount n={summary.rTotal} called={summary.bop.called.R} net={summary.netR} label="GOP" className="text-party-r-ink" right />
          </div>
          <BalanceBar bop={summary.bop} height={20} className="mt-4" />
          <p className="text-[11px] text-muted-foreground">
            Solid = projected by Big Board; translucent = uncalled, by consensus rating lean. Net change compares projected + leaning seats with seats
            held going into the election (toss-ups excluded).
          </p>
        </CardContent>
      </Card>

      {/* ---- Cartogram + side panel ---- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card size="sm" className="min-w-0">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                value={[mode]}
                onValueChange={(v) => v[0] && setMode(v[0] as MapMode)}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="Map colouring"
              >
                {MAP_MODES.map((m) => (
                  <ToggleGroupItem key={m.value} value={m.value} aria-label={m.label}>
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as HouseFilter)} size="sm" aria-label="Filter districts">
                  {HOUSE_FILTERS.map((f) => (
                    <ToggleGroupItem key={f.value} value={f.value} className="rounded-full px-2.5 text-xs data-pressed:bg-accent">
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
              label={label}
              onHover={setHover}
              onSelect={(id) => setPinned((p) => (p === id ? null : id))}
              selected={pinned}
              highlight={filtering ? matches : undefined}
              showLabels
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <Legend mode={mode} />
              <span className="tnum">
                {filtering ? `${filteredMetas.length} of ${metas.length} districts match` : `${metas.length} districts`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{HEXMAP_ATTRIBUTION}</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <GenericBallotPanel generic={generic} />
          <Card size="sm" className="hidden xl:block">
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="text-foreground font-medium">Hover</span> a district for its race card; <span className="text-foreground font-medium">click</span>{" "}
                to pin it. Filters dim non-matching tiles.
              </p>
              <p>
                Ratings: median of Cook, Inside Elections and Sabato via Wikipedia (CC BY-SA 4.0). 2024 margins: presidential result on 2026 district lines.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Floating race card ---- */}
      {focusId && (
        <div
          className={cn(
            "fixed z-30 w-[min(22rem,calc(100vw-1rem))] right-2 bottom-2 md:right-4 md:bottom-4 pointer-events-none",
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
            <RaceCard live={focusLive} meta={focusMeta} href={pinned && focusMeta ? `/state/${focusMeta.state}` : undefined} className="shadow-xl bg-popover" />
            {focusMeta && (
              <div className="mt-1 flex justify-between rounded-md bg-popover/90 px-2 py-1 text-[11px] text-muted-foreground tnum ring-1 ring-foreground/10">
                <span>2024 pres. {fmtMarginDR(focusMeta.baseline.presMargin2024)}</span>
                <span>Prior House {fmtMarginDR(focusMeta.baseline.prevRaceMargin)}</span>
                <span>Held {focusMeta.heldBy ?? "—"}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Poll-close watch ---- */}
      <PollCloseWatch metas={metas} states={states} live={live} onSelect={(id) => setPinned((p) => (p === id ? null : id))} selected={pinned} />

      {/* ---- Table ---- */}
      <Card size="sm">
        <CardContent>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="display text-lg font-semibold">All districts</h2>
            {filtering && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setFilter("all");
                  setStateFilter(ALL_STATES);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <HouseTable metas={filteredMetas} states={states} live={live} selected={pinned} onSelect={(id) => setPinned((p) => (p === id ? null : id))} />
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Candidates and ratings: Wikipedia (CC BY-SA 4.0). Vote counts: official state and county feeds, see{" "}
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
      <div className={cn("display text-5xl md:text-6xl font-bold tnum", className)}>
        <Num value={n} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {label} · <span className="tnum">{called}</span> called
      </div>
      <div className={cn("mt-0.5 text-xs tnum", net > 0 ? "text-live" : net < 0 ? "text-stale" : "text-muted-foreground")} title="Projected + leaning seats minus seats held before the election">
        {net > 0 ? "+" : ""}
        {net} vs 2024
      </div>
    </div>
  );
}

function Sw({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Legend({ mode }: { mode: MapMode }) {
  switch (mode) {
    case "status":
      return (
        <div className="flex flex-wrap gap-3">
          <Sw color="var(--party-d)" label="D projected" />
          <Sw color="color-mix(in oklch, var(--party-d) 50%, var(--uncalled))" label="D leaning" />
          <Sw color="var(--uncalled)" label="Toss-up" />
          <Sw color="color-mix(in oklch, var(--party-r) 50%, var(--uncalled))" label="R leaning" />
          <Sw color="var(--party-r)" label="R projected" />
        </div>
      );
    case "margin":
      return (
        <div className="flex flex-wrap gap-3 items-center">
          <span>Live D − R margin</span>
          <Sw color="var(--party-r)" label="R+30" />
          <Sw color="var(--uncalled)" label="Even" />
          <Sw color="var(--party-d)" label="D+30" />
          <span className="opacity-70">· grey = no votes yet</span>
        </div>
      );
    case "swing":
      return (
        <div className="flex flex-wrap gap-3 items-center">
          <span>Live margin minus 2024 presidential margin</span>
          <Sw color="var(--party-r)" label="→R 15" />
          <Sw color="var(--uncalled)" label="No swing" />
          <Sw color="var(--party-d)" label="→D 15" />
        </div>
      );
    case "ratings":
      return (
        <div className="flex flex-wrap gap-3">
          <Sw color="var(--party-d)" label="Solid D" />
          <Sw color="color-mix(in oklch, var(--party-d) 50%, var(--uncalled))" label="Lean D" />
          <Sw color="var(--uncalled)" label="Toss-up" />
          <Sw color="color-mix(in oklch, var(--party-r) 50%, var(--uncalled))" label="Lean R" />
          <Sw color="var(--party-r)" label="Solid R" />
        </div>
      );
  }
}
