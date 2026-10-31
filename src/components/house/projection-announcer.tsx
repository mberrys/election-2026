"use client";

import { useEffect, useRef, useState } from "react";
import { useNational } from "@/hooks/use-results";
import type { Race } from "@/data/schema";

type LiveRace = Omit<Race, "units">;

const MAX_SPOKEN = 3;

/**
 * Diffs successive national payloads and returns a sentence describing new or changed House projections,
 * e.g. "House: NC-01 projected for Don Davis (D)". The first payload seeds the baseline silently so a page
 * opened mid-count does not read out every existing call.
 */
export function useHouseProjectionDiff(races: LiveRace[] | undefined): string {
  const prev = useRef<Map<string, string> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!races) return;
    const next = new Map<string, string>();
    const changes: string[] = [];
    for (const r of races) {
      if (r.office !== "house" || !r.projection) continue;
      const key = `${r.projection.winnerId}|${r.projection.party}`;
      next.set(r.id, key);
      if (prev.current && prev.current.get(r.id) !== key) {
        const winner = r.candidates.find((c) => c.id === r.projection?.winnerId)?.name ?? r.projection.winnerId;
        changes.push(`House: ${r.id.replace(/^house:/, "")} projected for ${winner} (${r.projection.party})`);
      }
    }
    const first = prev.current == null;
    prev.current = next;
    if (first || changes.length === 0) return;
    const spoken = changes.slice(0, MAX_SPOKEN).join(". ");
    const extra = changes.length > MAX_SPOKEN ? `. ${changes.length - MAX_SPOKEN} more House projections` : "";
    setMessage(`${spoken}${extra}.`);
  }, [races]);

  return message;
}

/** Visually hidden polite live region. Mount exactly one per page. */
export function HouseProjectionAnnouncer() {
  const { data } = useNational();
  const message = useHouseProjectionDiff(data?.races);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
