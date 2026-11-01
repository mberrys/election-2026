import type { RaceMeta } from "@/data/schema";
import { RATING_LEAN, RATING_ORDER } from "@/data/schema";

/** How many cards the home page's "Key races" section shows. */
export const KEY_RACE_COUNT = 18;

/**
 * The closest competitive Senate, governor and House races by consensus rating: toss-ups first, then tilt and lean,
 * Senate before governor before House at the same distance. Shared by the board and the server page that decides
 * which candidate photos to send.
 */
export function selectKeyRaces(metas: readonly RaceMeta[]): RaceMeta[] {
  const score = (m: RaceMeta) => {
    const r = m.ratings.consensus ?? "tossup";
    const d = Math.abs(RATING_ORDER.indexOf(r) - 4); // 0 = tossup
    const officeW = m.office === "senate" ? 0 : m.office === "governor" ? 0.5 : 1;
    return d * 10 + officeW;
  };
  return metas
    .filter((m) => m.office !== "ballot" && m.office !== "stateleg")
    .filter((m) => {
      const r = m.ratings.consensus;
      return !r || RATING_LEAN[r] === "tossup" || r.startsWith("tilt") || r.startsWith("lean");
    })
    .sort((a, b) => score(a) - score(b) || a.state.localeCompare(b.state))
    .slice(0, KEY_RACE_COUNT);
}
