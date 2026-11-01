"use client";

import { raceHref } from "@/lib/race-slug";
import Link from "next/link";
import { useId, useMemo } from "react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { MarginDR } from "@/components/board/num";
import { fmtEt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isCompetitive, lastClose, liveMarginDR, pollCloseSortKey, ratingRank, shortDistrict, type LiveRace } from "./house-lib";

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
  const titleId = useId();
  const groups = useMemo(() => {
    // Group by the last close, which is the time `fmtEt` prints, so split states sit with their printed hour.
    const closeByState = new Map(states.map((s) => [s.abbr, lastClose(s.pollCloseEt)]));
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
    <section aria-labelledby={titleId} className="space-y-5">
      <div className="space-y-1.5">
        <h2 id={titleId} className="section-title">
          Seats to watch, by poll closing
        </h2>
        <p className="text-sm text-muted-foreground">Lean, tilt and toss-up seats, grouped by when the last polls in their state close (Eastern).</p>
      </div>
      <div className="flex snap-x items-start gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {groups.map((g) => (
          <section key={g.key} aria-label={`Polls close ${g.label}`} className="min-w-[14rem] max-w-[16rem] shrink-0 snap-start rounded-lg bg-card">
            <header className="flex items-baseline justify-between border-b border-border px-3 py-2">
              <h3 className="text-lg font-semibold tnum">{g.label}</h3>
              <span className="text-xs text-muted-foreground tnum">
                {g.list.length} seat{g.list.length === 1 ? "" : "s"}
              </span>
            </header>
            <ul className="max-h-80 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
              {g.list.map((m) => {
                const lr = live.get(m.id);
                const margin = liveMarginDR(lr);
                return (
                  <li
                    key={m.id}
                    className={cn("flex min-h-10 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-accent/40", selected === m.id && "bg-accent/60")}
                    onClick={() => onSelect?.(m.id)}
                  >
                    <Link href={raceHref(m.id)} className="w-14 shrink-0 font-semibold tnum hover:underline" onClick={(e) => e.stopPropagation()}>
                      {shortDistrict(m.id)}
                    </Link>
                    {lr?.projection ? (
                      <StatusBadge status="projected" party={lr.projection.party} className="ml-auto" />
                    ) : (
                      <>
                        <RatingBadge rating={m.ratings.consensus} className="shrink-0" />
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {margin != null ? <MarginDR value={margin} /> : m.heldBy ? `${m.heldBy} held` : "Open"}
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
