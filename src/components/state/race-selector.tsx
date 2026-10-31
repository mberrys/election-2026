"use client";

import type { Race, RaceMeta } from "@/data/schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartyDot, RatingBadge } from "@/components/board/status-badge";
import { cn } from "@/lib/utils";
import { groupRaces, raceTabLabel } from "./derive";

type LiveIndex = ReadonlyMap<string, Race>;

/**
 * Horizontal, scrollable race tabs grouped Senate → Governor → House districts → Ballot measures.
 * Each tab shows the consensus rating (pre-election) or a projected-winner dot (live).
 */
export function RaceSelector({
  metas,
  live,
  value,
  onChange,
}: {
  metas: RaceMeta[];
  live: LiveIndex;
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const g = groupRaces(metas);
  const groups: { label: string; items: RaceMeta[] }[] = [
    { label: "Senate", items: g.senate },
    { label: "Governor", items: g.governor },
    { label: "House", items: g.house },
    { label: "Measures", items: g.ballot },
  ].filter((x) => x.items.length > 0);

  if (!groups.length) return <p className="text-sm text-muted-foreground">No federal or statewide races on this state&apos;s ballot.</p>;

  return (
    <Tabs value={value ?? ""} onValueChange={(v) => v != null && onChange(String(v))} className="w-full">
      <TabsList variant="line" className="h-auto w-full justify-start gap-4 overflow-x-auto scrollbar-thin pb-1.5 flex-nowrap">
        {groups.map((grp) => (
          <div key={grp.label} className="flex shrink-0 items-center gap-1">
            <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{grp.label}</span>
            {grp.items.map((m) => {
              const r = live.get(m.id);
              const win = r?.projection;
              return (
                <TabsTrigger key={m.id} value={m.id} className={cn("h-7 shrink-0 gap-1.5 px-2 text-xs", m.office === "ballot" && "max-w-[14rem]")}>
                  <span className="truncate">{raceTabLabel(m)}</span>
                  {win ? (
                    <PartyDot party={win.party} />
                  ) : m.ratings.consensus && m.office !== "ballot" ? (
                    <RatingBadge rating={m.ratings.consensus} className="px-1 py-0 text-[9px]" />
                  ) : null}
                </TabsTrigger>
              );
            })}
          </div>
        ))}
      </TabsList>
    </Tabs>
  );
}
