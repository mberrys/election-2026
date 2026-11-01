import type { RatingCode } from "@/data/schema";

/** Display order, Democratic strongest on the left to Republican strongest on the right. */
export const RATING_ORDER: RatingCode[] = ["solid-d", "likely-d", "lean-d", "tilt-d", "tossup", "tilt-r", "lean-r", "likely-r", "solid-r"];

/** Short cell labels (the party is carried by colour and the side headings). */
export const RATING_WORD: Record<RatingCode, string> = {
  "solid-d": "Solid",
  "likely-d": "Likely",
  "lean-d": "Lean",
  "tilt-d": "Tilt",
  tossup: "Toss-up",
  "tilt-r": "Tilt",
  "lean-r": "Lean",
  "likely-r": "Likely",
  "solid-r": "Solid",
};

export interface RatingCounts {
  counts: Record<RatingCode, number>;
  /** Races that lean Democratic (tilt included), Republican, and toss-ups. */
  dSide: number;
  rSide: number;
  tossup: number;
  /** Races without a consensus rating. */
  unrated: number;
  total: number;
}

/** Tallies races by consensus rating. */
export function ratingCounts(races: { ratings: { consensus?: RatingCode } }[]): RatingCounts {
  const counts = Object.fromEntries(RATING_ORDER.map((r) => [r, 0])) as Record<RatingCode, number>;
  let unrated = 0;
  for (const r of races) {
    const c = r.ratings.consensus;
    if (c && c in counts) counts[c]++;
    else unrated++;
  }
  const sum = (side: "-d" | "-r") => RATING_ORDER.filter((r) => r.endsWith(side)).reduce((s, r) => s + counts[r], 0);
  return { counts, dSide: sum("-d"), rSide: sum("-r"), tossup: counts.tossup, unrated, total: races.length };
}
