import type { Race } from "./schema";

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
