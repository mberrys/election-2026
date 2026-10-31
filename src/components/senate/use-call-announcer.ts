"use client";

import { useState } from "react";
import type { RaceMeta } from "@/data/schema";
import type { LiveIndex, LiveRace } from "./balance";

type CallKey = string; // "" | "called:<winnerId>" | "runoff"

function snapshotOf(metas: readonly RaceMeta[], live: LiveIndex): Map<string, CallKey> {
  const snap = new Map<string, CallKey>();
  for (const m of metas) {
    const r = live.get(m.id);
    const key: CallKey = r?.projection
      ? `called:${r.projection.winnerId}`
      : r?.status === "runoff"
        ? "runoff"
        : "";
    snap.set(m.id, key);
  }
  return snap;
}

function describe(
  chamber: string,
  meta: RaceMeta,
  race: LiveRace | undefined,
  key: CallKey,
  stateName: (abbr: string) => string,
): string | undefined {
  const place = `${stateName(meta.state)}${meta.special ? " special" : ""}`;
  if (key === "runoff") return `${chamber}: ${place} heads to a runoff`;
  if (key.startsWith("called:")) {
    const id = key.slice(7);
    const cand = meta.candidates.find((c) => c.id === id) ?? race?.candidates.find((c) => c.id === id);
    const who = cand ? `${cand.name} (${cand.party})` : race?.projection?.party ? `the ${race.projection.party}` : "a candidate";
    return `${chamber}: ${place} projected for ${who}`;
  }
  return undefined;
}

/**
 * Diffs projections between renders and returns a sentence for a visually hidden aria-live region.
 * Only calls that happen while the page is open are announced: the first live payload after load
 * seeds the baseline silently. Uses the "derive from previous render" state pattern (no effects).
 */
export function useCallAnnouncer(
  chamber: string,
  metas: readonly RaceMeta[],
  live: LiveIndex,
  stateName: (abbr: string) => string,
): string {
  const [tracked, setTracked] = useState<{ live: LiveIndex; snap: Map<string, CallKey>; message: string }>(() => ({
    live,
    snap: snapshotOf(metas, live),
    message: "",
  }));

  if (tracked.live === live) return tracked.message;

  const snap = snapshotOf(metas, live);
  const sentences: string[] = [];
  if (tracked.live.size > 0) {
    for (const m of metas) {
      const key = snap.get(m.id) ?? "";
      if (!key || key === tracked.snap.get(m.id)) continue;
      const s = describe(chamber, m, live.get(m.id), key, stateName);
      if (s) sentences.push(s);
    }
  }
  const message = sentences.length ? sentences.join(". ") + "." : tracked.message;
  setTracked({ live, snap, message });
  return message;
}
