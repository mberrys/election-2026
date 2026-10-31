import type { BalanceOfPower } from "@/data/schema";
import { cn } from "@/lib/utils";

/**
 * Balance-of-power bar. Left: D (called solid, leaning soft, not-up faint). Right: R mirrored. Middle: toss-ups.
 * Pure SVG-free flexbox so it renders in the static shell and animates width via CSS transitions.
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
      <div className="flex w-full overflow-hidden rounded-sm bg-uncalled/40" style={{ height }}>
        <Seg w={pct(dNotUp)} className="bg-party-d-faint" title="D/I not up" />
        <Seg w={pct(bop.called.D + bop.called.I)} className="bg-party-d" title="D won" />
        <Seg w={pct(bop.leaning.D + bop.leaning.I)} className="bg-party-d-soft" title="D leaning (uncalled)" />
        <Seg w={pct(middle)} className="bg-transparent" title="Toss-up / uncalled" />
        <Seg w={pct(bop.leaning.R)} className="bg-party-r-soft" title="R leaning (uncalled)" />
        <Seg w={pct(bop.called.R)} className="bg-party-r" title="R won" />
        <Seg w={pct(rNotUp)} className="bg-party-r-faint" title="R not up" />
      </div>
      {showMajorityTick && bop.majority > 0 && (
        <div
          className="absolute -top-1 bottom-[-4px] w-px bg-foreground/80"
          style={{ left: pct(bop.majority) }}
          aria-hidden
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground tnum">
            {bop.majority}
          </span>
        </div>
      )}
    </div>
  );
}

function Seg({ w, className, title }: { w: string; className: string; title: string }) {
  return <div className={cn("h-full transition-[width] duration-700 ease-out", className)} style={{ width: w }} title={title} />;
}
