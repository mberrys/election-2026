import type { RatingCode } from "@/data/schema";

/** Ramp step per rating strength: tilt 2, lean 3, likely 4, solid 5 (step 1 is too pale on the light theme's card). */
const STEP = { tilt: 2, lean: 3, likely: 4, solid: 5 } as const;

/** Fill for a rating: the party's margin ramp by strength, and a neutral for toss-ups. */
export function ratingFill(r: RatingCode): string {
  if (r === "tossup") return "var(--ink-faint)";
  const [strength, side] = r.split("-") as [keyof typeof STEP, "d" | "r"];
  return `var(--ramp-${side}-${STEP[strength]})`;
}
