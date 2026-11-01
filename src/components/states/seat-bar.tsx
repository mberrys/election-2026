import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { segmentFill, type SeatSplit } from "./states-lib";

/** Chamber seats as one bar, majority-holder first; the ink tick marks the seat that makes a majority. */
export function SeatBar({ split, className, tick = true }: { split: SeatSplit; className?: string; tick?: boolean }) {
  const at = (split.majority / split.total) * 100;
  return (
    <div className={cn("relative h-2.5", className)}>
      <div className="flex h-full gap-px overflow-hidden rounded-[2px]">
        {split.segments.map((s, i) =>
          s.n > 0 ? (
            <span
              key={`${s.key}-${i}`}
              className={cn("h-full", s.key === "opposition" && "hatch-sm")}
              style={{ width: `${(s.n / split.total) * 100}%`, background: s.key === "opposition" ? undefined : segmentFill(s.key) }}
            />
          ) : null,
        )}
      </div>
      {tick && <span aria-hidden className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${at}%` }} />}
    </div>
  );
}

/** Filter chip row; the selected chip is a solid ink pill. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: string; count?: number; swatch?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-signal",
              on ? "bg-ink text-ground" : "bg-s3 text-ink-muted hover:bg-s4 hover:text-ink",
            )}
          >
            {o.swatch}
            {o.label}
            {o.count != null && <span className={cn("tnum text-sm", on ? "text-ground/70" : "text-ink-faint")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** One big figure with its label under it. */
export function BigStat({ value, label, color, className }: { value: ReactNode; label: string; color?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-4xl font-bold leading-none tnum" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="mt-2 text-[15px] text-muted-foreground">{label}</div>
    </div>
  );
}
