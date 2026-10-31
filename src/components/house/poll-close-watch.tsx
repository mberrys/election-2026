"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { MarginDR } from "@/components/board/num";
import { fmtEt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isCompetitive, liveMarginDR, pollCloseSortKey, ratingRank, shortDistrict, type LiveRace } from "./house-lib";

/** Competitive House seats grouped by their state's (last) poll-closing hour, 6pm → 1am ET. */
export function PollCloseWatch({
  metas,
  states,
  live,
  onSelect,
  selected,
}: {
  metas: RaceMeta[];
  states: StateMeta[];
  live: Map<string, LiveRace>;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const groups = useMemo(() => {
    const closeByState = new Map(states.map((s) => [s.abbr, s.pollCloseEt]));
    const byHour = new Map<string, RaceMeta[]>();
    for (const m of metas) {
      if (!isCompetitive(m)) continue;
      const key = closeByState.get(m.state) ?? "unknown";
      const arr = byHour.get(key) ?? [];
      arr.push(m);
      byHour.set(key, arr);
    }
    return [...byHour.entries()]
      .map(([key, list]) => ({
        key,
        label: key === "unknown" ? "Close time unknown" : fmtEt(key),
        list: list.sort((a, b) => ratingRank(a.ratings.consensus) - ratingRank(b.ratings.consensus) || a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => (a.key === "unknown" ? 1 : b.key === "unknown" ? -1 : pollCloseSortKey(a.key) - pollCloseSortKey(b.key)));
  }, [metas, states]);

  if (groups.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
          Seats to watch, by poll-closing hour <span className="normal-case tracking-normal">(lean, tilt and toss-up seats)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x">
          {groups.map((g) => (
            <section key={g.key} className="min-w-[13.5rem] max-w-[16rem] shrink-0 snap-start rounded-lg bg-muted/30 ring-1 ring-foreground/5">
              <header className="flex items-baseline justify-between px-2.5 py-1.5 border-b border-border/60">
                <h3 className="display text-base font-semibold tnum">{g.label}</h3>
                <span className="text-[11px] text-muted-foreground tnum">{g.list.length}</span>
              </header>
              <ul className="max-h-72 overflow-y-auto scrollbar-thin divide-y divide-border/40">
                {g.list.map((m) => {
                  const lr = live.get(m.id);
                  const margin = liveMarginDR(lr);
                  return (
                    <li
                      key={m.id}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-accent/40 cursor-pointer", selected === m.id && "bg-accent/60")}
                      onClick={() => onSelect?.(m.id)}
                    >
                      <Link
                        href={`/state/${m.state}`}
                        className="font-semibold tnum w-12 shrink-0 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {shortDistrict(m.id)}
                      </Link>
                      <RatingBadge rating={m.ratings.consensus} className="shrink-0" />
                      <span className="ml-auto shrink-0">
                        {lr?.projection ? (
                          <StatusBadge status="projected" party={lr.projection.party} className="h-4 px-1.5 text-[10px]" />
                        ) : margin != null ? (
                          <MarginDR value={margin} />
                        ) : (
                          <span className="text-muted-foreground">{m.heldBy ? `${m.heldBy} held` : "open"}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
