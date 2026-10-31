import { cn } from "@/lib/utils";

/**
 * Hatch primitives shared by bars, cards, tiles and maps.
 * Solid is known, hatched is still out: see the grammar at the top of globals.css.
 */

/** SVG twin of the CSS `.hatch`: put inside <defs>, then fill="url(#id)". `pitch` is in the SVG's user units. */
export function HatchPattern({
  id,
  pitch = 6,
  line = "var(--hatch-line)",
  ground = "var(--hatch-ground)",
  stroke,
}: {
  id: string;
  pitch?: number;
  line?: string;
  ground?: string;
  /** Line width in user units; defaults to a quarter of the pitch (1.5px at a 6px pitch). */
  stroke?: number;
}) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={pitch} height={pitch} patternTransform="rotate(45)">
      <rect width={pitch} height={pitch} fill={ground} />
      <line x1={0} y1={0} x2={0} y2={pitch} stroke={line} strokeWidth={stroke ?? pitch / 4} />
    </pattern>
  );
}

/** "BB": our own projection, never a network call. Dark text on the party colour, or on ink when no party. */
export function BBStamp({ party, className }: { party?: "D" | "R" | "I" | "O"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-4 shrink-0 items-center justify-center rounded-[2px] px-1 text-[12px] leading-none font-extrabold",
        party === "D" ? "bg-party-d text-on-party" : party === "R" ? "bg-party-r text-on-party" : party ? "bg-party-i text-ground" : "bg-ink text-ground",
        className,
      )}
      style={{ fontStretch: "125%" }}
    >
      BB
    </span>
  );
}

/** Decided (mathematically settled or certified): an ink check. */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("h-3 w-3 shrink-0", className)}>
      <path d="M2 6.4 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square" />
    </svg>
  );
}

export type Freshness = "live" | "stale" | "held";

/** Freshness: live = chartreuse dot, stale = hollow grey ring, held = amber square. Static under reduced motion. */
export function FreshDot({ state, className }: { state: Freshness; className?: string }) {
  if (state === "held") return <span aria-hidden className={cn("inline-block h-3 w-3 shrink-0 bg-alert", className)} />;
  if (state === "stale")
    return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-stale", className)} />;
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-signal", className)} />;
}

export type SwatchKind =
  | "uncounted"
  | "lean-d"
  | "lean-r"
  | "leading-d"
  | "leading-r"
  | "projected-d"
  | "projected-r"
  | "held"
  | `ramp-d-${1 | 2 | 3 | 4 | 5}`
  | `ramp-r-${1 | 2 | 3 | 4 | 5}`;

/** Legend chip drawn in the same grammar as the marks it explains. */
export function Swatch({ kind, className }: { kind: SwatchKind; className?: string }) {
  const base = "relative inline-block h-3.5 w-3.5 shrink-0 rounded-[2px]";
  if (kind === "uncounted") return <i aria-hidden className={cn(base, "hatch-sm", className)} />;
  if (kind === "lean-d") return <i aria-hidden className={cn(base, "hatch-d", className)} />;
  if (kind === "lean-r") return <i aria-hidden className={cn(base, "hatch-r", className)} />;
  if (kind === "held") return <i aria-hidden className={cn(base, "hazard", className)} />;
  if (kind === "leading-d" || kind === "leading-r") {
    const d = kind === "leading-d";
    return (
      <i aria-hidden className={cn(base, d ? "bg-party-d-tint" : "bg-party-r-tint", className)}>
        <span className={cn("absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full", d ? "bg-party-d" : "bg-party-r")} />
      </i>
    );
  }
  if (kind === "projected-d") return <i aria-hidden className={cn(base, "bg-party-d", className)} />;
  if (kind === "projected-r") return <i aria-hidden className={cn(base, "bg-party-r", className)} />;
  return <i aria-hidden className={cn(base, className)} style={{ background: `var(--${kind})` }} />;
}

/** Margin ramp step (1–5) for a margin in points: tilt <2, lean 2–5, likely 5–10, safe 10–20, landslide 20+. */
export function rampStep(marginPts: number): 1 | 2 | 3 | 4 | 5 {
  const m = Math.abs(marginPts);
  return m < 2 ? 1 : m < 5 ? 2 : m < 10 ? 3 : m < 20 ? 4 : 5;
}

/** CSS colour for a D−R margin on the 5-step ramp. */
export function rampColor(marginDR: number): string {
  return `var(--ramp-${marginDR >= 0 ? "d" : "r"}-${rampStep(marginDR)})`;
}
