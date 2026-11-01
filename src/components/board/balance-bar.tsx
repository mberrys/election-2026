import type { BalanceOfPower } from "@/data/schema";
import { cn } from "@/lib/utils";

/**
 * Balance-of-power bar in the Hatch grammar. Left: D. Right: R mirrored.
 *   not up   → solid, one ramp step down (known, but not tonight's)
 *   won      → solid party colour
 *   leaning  → a pale party tint (uncalled; the rating leans that way)
 *   toss-up  → flat neutral
 * The majority line is a 2px ink tick. Plain flexbox so it renders in the static shell; widths grow over 900ms.
 */
export function BalanceBar({
  bop,
  className,
  showMajorityTick = true,
  height = 14,
}: {
  bop: BalanceOfPower;
  className?: string;
  showMajorityTick?: boolean;
  height?: number;
}) {
  const total = bop.total || 1;
  const pct = (n: number) => `${(100 * n) / total}%`;
  const dNotUp = bop.notUp.D + bop.notUp.I; // caucus with D for the Senate math; governors have 0 notUp
  const rNotUp = bop.notUp.R;
  const dTotal = dNotUp + bop.called.D + bop.called.I + bop.leaning.D + bop.leaning.I;
  const rTotal = rNotUp + bop.called.R + bop.leaning.R;
  const middle = Math.max(0, total - dTotal - rTotal);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="flex w-full gap-px overflow-hidden rounded-[2px] bg-s3" style={{ height }}>
        <Seg w={pct(dNotUp)} className="bg-ramp-d-2" title="D/I not up" />
        <Seg w={pct(bop.called.D + bop.called.I)} className="bg-party-d" title="D won" />
        <Seg w={pct(bop.leaning.D + bop.leaning.I)} className="bg-party-d-muted" title="D leaning (uncalled)" />
        <Seg w={pct(middle)} className="bg-s4" title="Toss-up / uncalled" />
        <Seg w={pct(bop.leaning.R)} className="bg-party-r-muted" title="R leaning (uncalled)" />
        <Seg w={pct(bop.called.R)} className="bg-party-r" title="R won" />
        <Seg w={pct(rNotUp)} className="bg-ramp-r-2" title="R not up" />
      </div>
      {showMajorityTick && bop.majority > 0 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: pct(bop.majority) }}
          aria-hidden
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground tnum">{bop.majority}</span>
        </div>
      )}
    </div>
  );
}

function Seg({ w, className, title }: { w: string; className: string; title: string }) {
  return <div className={cn("h-full anim-bar", className)} style={{ width: w }} title={title} />;
}
