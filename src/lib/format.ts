import type { Party, RatingCode } from "@/data/schema";

export const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const fmtVotes = (n: number | undefined | null) => (n == null ? "—" : nf0.format(n));
export const fmtPct = (n: number | undefined | null, digits = 1) =>
  n == null || Number.isNaN(n) ? "—" : `${n.toFixed(digits)}%`;

/** D − R points → "D+4.2" / "R+0.8" / "Even". */
export function fmtMarginDR(m: number | undefined | null, digits = 1): string {
  if (m == null || Number.isNaN(m)) return "—";
  if (Math.abs(m) < 0.05) return "Even";
  return `${m > 0 ? "D" : "R"}+${Math.abs(m).toFixed(digits)}`;
}

export const partyLabel: Record<Party, string> = { D: "Dem", R: "GOP", I: "Ind", L: "Lib", G: "Green", O: "Other" };
export const partyName: Record<Party, string> = {
  D: "Democratic",
  R: "Republican",
  I: "Independent",
  L: "Libertarian",
  G: "Green",
  O: "Other",
};

export function partyColorVar(p: Party | "tossup" | undefined): string {
  switch (p) {
    case "D":
      return "var(--party-d)";
    case "R":
      return "var(--party-r)";
    case "I":
    case "G":
    case "L":
      return "var(--party-i)";
    case "O":
      return "var(--party-o)";
    default:
      return "var(--uncalled)";
  }
}

export const ratingLabel: Record<RatingCode, string> = {
  "solid-d": "Solid D",
  "likely-d": "Likely D",
  "lean-d": "Lean D",
  "tilt-d": "Tilt D",
  tossup: "Toss-up",
  "tilt-r": "Tilt R",
  "lean-r": "Lean R",
  "likely-r": "Likely R",
  "solid-r": "Solid R",
};

export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

/** "19:30" ET → "7:30 PM ET". Split-state values like "19:00/20:00" use the LAST close. */
export function fmtEt(hhmm: string): string {
  const [h, m] = hhmm.split("/").pop()!.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""} ${suffix} ET`;
}
