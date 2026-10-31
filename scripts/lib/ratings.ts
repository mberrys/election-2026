import { RATING_ORDER, type RatingCode } from "../../src/data/schema";

/** Parse "Lean D", "{{USRaceRating|Tilt|R|Flip}}", "Toss-up", "Safe Republican" → RatingCode. */
export function parseRating(raw: string | undefined): RatingCode | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, " ").trim();
  const tpl = /USRaceRating\s*\|\s*([A-Za-z -]+?)\s*(?:\|\s*([A-Za-z]+)\s*)?(?:\|[^}]*)?\}\}/i.exec(s);
  let level: string | undefined;
  let party: string | undefined;
  if (tpl) {
    level = tpl[1];
    party = tpl[2];
  } else {
    const m = /\b(solid|safe|likely|lean|tilt|toss-?\s?up)\b\s*\.?\s*(D|R|Dem\w*|Rep\w*|GOP)?/i.exec(s);
    if (!m) return undefined;
    level = m[1];
    party = m[2];
  }
  const lv = level.toLowerCase().replace(/[\s-]/g, "");
  if (lv === "tossup") return "tossup";
  const p = (party ?? "").toLowerCase();
  const side = p.startsWith("d") ? "d" : p.startsWith("r") || p === "gop" ? "r" : undefined;
  if (!side) return undefined;
  if (lv === "solid" || lv === "safe") return `solid-${side}`;
  if (lv === "likely") return `likely-${side}`;
  if (lv === "lean") return `lean-${side}`;
  if (lv === "tilt") return `tilt-${side}`;
  return undefined;
}

/** Median of available ratings on the 9-step scale; ties round toward tossup. */
export function consensusRating(codes: Array<RatingCode | undefined>): RatingCode | undefined {
  const idx = codes
    .filter((c): c is RatingCode => !!c)
    .map((c) => RATING_ORDER.indexOf(c))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (idx.length === 0) return undefined;
  const mid = Math.floor(idx.length / 2);
  let v: number;
  if (idx.length % 2) v = idx[mid];
  else {
    const m = (idx[mid - 1] + idx[mid]) / 2;
    // half-step: round toward tossup (index 4)
    v = m < 4 ? Math.ceil(m) : Math.floor(m);
  }
  return RATING_ORDER[v];
}

export function ratingLabel(c: RatingCode): string {
  if (c === "tossup") return "Toss-up";
  const [lvl, side] = c.split("-");
  const l = lvl[0].toUpperCase() + lvl.slice(1);
  return `${l} ${side === "d" ? "D" : "R"}`;
}
