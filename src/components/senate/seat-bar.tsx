import { cn } from "@/lib/utils";

/**
 * Flat three-part bar for the pre-call view: seats on each side by rating, toss-ups in the middle.
 * No hatch: before any call nothing is "outstanding" in the counting sense, so the bar only shows
 * how the ratings split the chamber. Once a seat is called the boards switch to the shared BalanceBar.
 */
export function SeatBar({
  d,
  r,
  total,
  majority,
  majorityLabel,
  height = 12,
  className,
}: {
  d: number;
  r: number;
  total: number;
  /** Draws a tick at this seat count when given. */
  majority?: number;
  majorityLabel?: string;
  height?: number;
  className?: string;
}) {
  const t = total || 1;
  const pct = (n: number) => `${(100 * Math.max(0, n)) / t}%`;
  return (
    <div className={cn("relative w-full", majority && "pt-6", className)}>
      <div className="flex w-full gap-0.5 overflow-hidden rounded-[2px]" style={{ height }}>
        <div className="anim-bar h-full bg-party-d" style={{ width: pct(d) }} />
        <div className="anim-bar h-full bg-border-strong" style={{ width: pct(total - d - r) }} />
        <div className="anim-bar h-full bg-party-r" style={{ width: pct(r) }} />
      </div>
      {majority ? (
        <div aria-hidden className="absolute bottom-[-4px] top-5 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: pct(majority) }}>
          <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground tnum">
            {majorityLabel ?? majority}
          </span>
        </div>
      ) : null}
    </div>
  );
}
