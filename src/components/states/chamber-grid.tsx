"use client";

import { useEffect, useMemo, useState } from "react";
import type { RaceMeta } from "@/data/schema";
import type { StateTilesFile } from "@/data/geo/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/board/status-badge";
import { Pct } from "@/components/board/num";
import { cn } from "@/lib/utils";
import { chamberControl, chamberKind, chamberName, composition, controlFill, type ChamberControl, type LiveRace } from "./states-lib";

type StateChambers = {
  state: string;
  upper?: { meta: RaceMeta; control: ChamberControl; live?: LiveRace };
  lower?: { meta: RaceMeta; control: ChamberControl; live?: LiveRace };
  unicameral?: { meta: RaceMeta; control: ChamberControl; live?: LiveRace };
  governor?: { meta: RaceMeta; control: ChamberControl; live?: LiveRace };
};

/**
 * Small-multiples state tile map: each tile split into upper (top) and lower (bottom) chamber halves,
 * coloured by projected/current control. Tiles for states with no chamber on the 2026 ballot stay outlined.
 */
export function ChamberGrid({
  legs,
  governors,
  live,
  stateNames,
  src = "/data/geo/state-tiles.json",
}: {
  legs: RaceMeta[];
  governors: RaceMeta[];
  live: Map<string, LiveRace>;
  stateNames: Map<string, string>;
  src?: string;
}) {
  const [tiles, setTiles] = useState<StateTilesFile | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => r.json())
      .then((t: StateTilesFile) => alive && setTiles(t))
      .catch(() => alive && setTiles(null));
    return () => {
      alive = false;
    };
  }, [src]);

  const byState = useMemo(() => {
    const map = new Map<string, StateChambers>();
    const get = (st: string) => {
      const cur = map.get(st) ?? { state: st };
      map.set(st, cur);
      return cur;
    };
    for (const m of legs) {
      const lr = live.get(m.id);
      const entry = { meta: m, control: chamberControl(lr, m), live: lr };
      get(m.state)[chamberKind(m)] = entry;
    }
    for (const g of governors) {
      const lr = live.get(g.id);
      get(g.state).governor = { meta: g, control: chamberControl(lr, g), live: lr };
    }
    return map;
  }, [legs, governors, live]);

  const rows = useMemo(
    () =>
      [...byState.values()]
        .filter((s) => s.upper || s.lower || s.unicameral)
        .sort((a, b) => (stateNames.get(a.state) ?? a.state).localeCompare(stateNames.get(b.state) ?? b.state)),
    [byState, stateNames],
  );

  const counts = useMemo(() => {
    let d = 0;
    let r = 0;
    let other = 0;
    for (const s of rows) {
      for (const c of [s.upper, s.lower, s.unicameral]) {
        if (!c) continue;
        if (c.control.party === "D") d++;
        else if (c.control.party === "R") r++;
        else other++;
      }
    }
    return { d, r, other, total: d + r + other };
  }, [rows]);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Legislative chamber control</CardTitle>
        <p className="text-xs text-muted-foreground">
          <span className="tnum">{counts.total}</span> chambers hold elections in 2026: <span className="text-party-d-ink tnum">{counts.d} D</span>,{" "}
          <span className="text-party-r-ink tnum">{counts.r} R</span>, <span className="tnum">{counts.other}</span> coalition / tied. Top half = upper chamber, bottom = lower.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {tiles ? (
          <div
            className="grid gap-1 max-w-3xl"
            style={{ gridTemplateColumns: `repeat(${tiles.cols}, minmax(0, 1fr))` }}
            role="img"
            aria-label="State tile map of legislative chamber control"
          >
            {tiles.tiles.map((t) => {
              const s = byState.get(t.state);
              const up = s?.unicameral ?? s?.upper;
              const low = s?.unicameral ?? s?.lower;
              const anyUp = !!(s?.upper || s?.lower || s?.unicameral);
              const title = [
                t.name,
                s?.unicameral ? `Legislature: ${s.unicameral.control.label}${s.unicameral.control.called ? " (projected)" : ""}` : null,
                s?.upper ? `Senate: ${s.upper.control.label}${s.upper.control.called ? " (projected)" : ""}` : null,
                s?.lower ? `${chamberName(s.lower.meta)}: ${s.lower.control.label}${s.lower.control.called ? " (projected)" : ""}` : null,
                s?.governor ? `Governor: ${s.governor.control.label}` : null,
                !anyUp ? "No chambers up in 2026" : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={t.state}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-sm ring-1 text-[11px] md:text-xs",
                    anyUp ? "ring-foreground/20" : "ring-foreground/10 bg-muted/20",
                  )}
                  style={{ gridColumn: t.col + 1, gridRow: t.row + 1 }}
                  title={title}
                >
                  {anyUp && (
                    <>
                      <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: controlFill(up?.control) }} />
                      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: controlFill(low?.control) }} />
                      {!s?.unicameral && <div className="absolute inset-x-0 top-1/2 h-px bg-background/70" />}
                    </>
                  )}
                  <span className={cn("absolute inset-0 grid place-items-center font-semibold", anyUp ? "text-white drop-shadow" : "text-muted-foreground/70")}>
                    {t.state}
                  </span>
                  {s?.governor && (
                    <span
                      className="absolute right-0.5 top-0.5 size-1.5 rounded-full ring-1 ring-background"
                      style={{ background: controlFill({ ...s.governor.control, called: true }) }}
                      aria-hidden
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="aspect-[12/8] max-w-3xl animate-pulse rounded-md bg-muted/40" />
        )}

        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Sw color="var(--party-d)" label="D control (projected)" />
          <Sw color={controlFill({ party: "D", called: false, label: "D" })} label="D control (current)" />
          <Sw color="var(--party-r)" label="R control (projected)" />
          <Sw color={controlFill({ party: "R", called: false, label: "R" })} label="R control (current)" />
          <Sw color={controlFill({ party: null, called: false, label: "Coal." })} label="Coalition / tied" />
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm ring-1 ring-foreground/20 bg-muted/20" /> Not up in 2026
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-party-i" /> dot = governor race
          </span>
        </div>

        <Table className="text-xs md:text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground">State</TableHead>
              <TableHead className="text-xs text-muted-foreground">Chamber</TableHead>
              <TableHead className="text-xs text-muted-foreground">Going in</TableHead>
              <TableHead className="text-xs text-muted-foreground text-right">% in</TableHead>
              <TableHead className="text-xs text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.flatMap((s) =>
              [s.unicameral, s.upper, s.lower].filter(Boolean).map((c, i) => {
                const ch = c!;
                const p = ch.live?.pctExpected;
                return (
                  <TableRow key={ch.meta.id}>
                    <TableCell className="font-semibold">{i === 0 ? (stateNames.get(s.state) ?? s.state) : ""}</TableCell>
                    <TableCell>{chamberName(ch.meta)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-sm" style={{ background: controlFill({ ...ch.control, called: true }) }} />
                        <span className="tnum">{composition(ch.meta) ?? ch.control.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Pct value={p == null ? undefined : p <= 1 ? p * 100 : p} digits={0} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ch.live?.status ?? "not_started"} party={ch.live?.projection?.party} />
                    </TableCell>
                  </TableRow>
                );
              }),
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
