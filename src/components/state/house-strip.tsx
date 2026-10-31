"use client";

import type { Race, RaceMeta } from "@/data/schema";
import { RaceCard } from "@/components/board/race-card";
import { cn } from "@/lib/utils";

/** Compact cards for every House district in the state. Clicking one selects it in the race selector. */
export function HouseStrip({
  metas,
  live,
  selectedId,
  onSelect,
  className,
}: {
  metas: RaceMeta[];
  live: ReadonlyMap<string, Race>;
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  if (!metas.length) return null;
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4", className)}>
      {metas.map((m) => (
        <li key={m.id}>
          <div
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === m.id}
            onClick={() => onSelect(m.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(m.id);
              }
            }}
            className={cn("rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", selectedId === m.id && "[&>div]:border-foreground/40")}
          >
            <RaceCard live={live.get(m.id)} meta={m} />
          </div>
        </li>
      ))}
    </ul>
  );
}
