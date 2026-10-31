import type { Race } from "./schema";
import type { Annotation } from "./annotations";

/**
 * Integrity watch. The list is DYNAMIC: it starts from a base set and grows during the night.
 *
 *  - Base states (user-designated 2026-10-30): MI, GA, AZ, AK, CA, WA.
 *  - Any state with an annotation (static file or POST /api/annotations: litigation, set-aside,
 *    count-paused, advisory) joins automatically.
 *  - Any state where a race or county count stalls joins automatically and stays on for the night.
 *
 * Effects for every watched state: model (non-mathematical) calls need WATCH_MIN_PCT of expected vote,
 * and the national board lists it in the Integrity Watch panel with its reasons.
 */
export const BASE_WATCH_STATES = ["MI", "GA", "AZ", "AK", "CA", "WA"] as const;
export const WATCH_MIN_PCT = 0.9;

export type WatchEntry = { state: string; reasons: string[]; base: boolean };

/** State an annotation applies to ("senate:AK" → AK, "house:NC-01" → NC, or its explicit `state`). */
export function annotationState(a: Pick<Annotation, "raceId" | "state">): string | undefined {
  if (a.state) return a.state.toUpperCase();
  return a.raceId?.match(/:([A-Z]{2})(?:-|$)/)?.[1];
}

const KIND_REASON: Record<Annotation["kind"], string> = {
  litigation: "Litigation",
  "set-aside": "Ballots set aside",
  "count-paused": "Count paused",
  advisory: "Advisory",
};

export const STALL_REASON = "Stalled count";

/**
 * Merge every source into one list. `previous` keeps stall-triggered states watched for the rest of the night,
 * so a county that resumes counting doesn't silently drop off the panel.
 */
export function resolveWatch({
  annotations,
  stalledStates = [],
  previous = [],
}: {
  annotations: Annotation[];
  stalledStates?: Iterable<string>;
  previous?: WatchEntry[];
}): WatchEntry[] {
  const map = new Map<string, WatchEntry>();
  const add = (state: string, reason?: string, base = false) => {
    const e = map.get(state) ?? { state, reasons: [], base };
    e.base ||= base;
    if (reason && !e.reasons.includes(reason)) e.reasons.push(reason);
    map.set(state, e);
  };
  for (const st of BASE_WATCH_STATES) add(st, undefined, true);
  for (const a of annotations) {
    const st = annotationState(a);
    if (st) add(st, KIND_REASON[a.kind]);
  }
  for (const p of previous) if (p.reasons.includes(STALL_REASON)) add(p.state, STALL_REASON);
  for (const st of stalledStates) add(st, STALL_REASON);
  return [...map.values()].sort((a, b) => Number(b.base) - Number(a.base) || a.state.localeCompare(b.state));
}

/** A count is "stalled" when polls have closed, it is <90% in, and the total hasn't moved for this long. */
export const STALL_MINUTES = 45;

export function stalledMinutes(
  race: Pick<Race, "lastChangeAt" | "pctExpected" | "totalVotes" | "precinctsReporting" | "precinctsTotal">,
  now: number,
): number | null {
  if (!race.lastChangeAt || race.totalVotes <= 0) return null;
  // (Nearly) all precincts in: a plateau is a finished count (late mail aside), not a stall.
  if (race.precinctsTotal && (race.precinctsReporting ?? 0) >= 0.98 * race.precinctsTotal) return null;
  // The last stretch (late mail, provisional, overseas) routinely sits still for hours; only mid-count freezes matter.
  if ((race.pctExpected ?? 0) >= 0.9) return null;
  const mins = (now - Date.parse(race.lastChangeAt)) / 60_000;
  return mins >= STALL_MINUTES ? Math.round(mins) : null;
}
