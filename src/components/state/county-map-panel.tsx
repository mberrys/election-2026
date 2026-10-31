"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { divergingT, swingVs2024 } from "@/analytics";
import { CountyMap, marginFill } from "@/components/maps/county-map";
import { rampColor, Swatch } from "@/components/board/hatch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fmtMarginDR, fmtPct, fmtVotes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountyRow } from "./derive";

export type MapMode = "margin" | "swing" | "benchmark" | "pctin";

const MODES: { value: MapMode; label: string; hint: string }[] = [
  { value: "margin", label: "Margin", hint: "Live D − R margin; opacity = share of expected vote in" },
  { value: "swing", label: "Swing vs 2024", hint: "Live margin minus the county's 2024 presidential margin" },
  { value: "benchmark", label: "vs Benchmark", hint: "Over/under the margin each county needs for the race to be tied statewide" },
  { value: "pctin", label: "% in", hint: "Share of expected vote reported" },
];

/** Diverging fill around 0 on the margin ramp: blue for +, red for −, a neutral surface near centre. */
function divergingFill(v: number | undefined, range: number, pctIn?: number) {
  if (v == null || Number.isNaN(v)) return null;
  const t = divergingT(v, range);
  const strength = Math.abs(t - 0.5) * 2;
  const opacity = pctIn == null ? 1 : 0.35 + 0.65 * Math.min(1, pctIn);
  if (strength < 0.04) return { fill: "var(--s4)", opacity: Math.max(0.5, opacity) };
  return { fill: rampColor(v), opacity };
}

export function CountyMapPanel({
  stateFips,
  rows,
  selected,
  onSelect,
  mode,
  onModeChange,
  className,
}: {
  stateFips: string;
  rows: CountyRow[];
  selected: string | null;
  onSelect: (fips: string | null) => void;
  mode: MapMode;
  onModeChange: (m: MapMode) => void;
  className?: string;
}) {
  const byFips = useMemo(() => {
    const m = new Map<string, CountyRow>();
    for (const r of rows) if (r.fips) m.set(r.fips, r);
    return m;
  }, [rows]);

  const fill = useCallback(
    (fips: string) => {
      const r = byFips.get(fips);
      if (!r) return null;
      switch (mode) {
        case "margin":
          return r.margin == null ? null : marginFill(r.margin, r.pctIn);
        case "swing": {
          if (r.margin2024 == null) return null;
          // Pre-election / nothing reported: swing is 0 → neutral.
          const swing = r.margin == null ? 0 : swingVs2024(r.margin, r.margin2024);
          return divergingFill(swing, 15, r.margin == null ? 0 : r.pctIn);
        }
        case "benchmark":
          return divergingFill(r.overUnder, 15, r.pctIn);
        case "pctin": {
          const p = Math.min(1, Math.max(0, r.pctIn ?? 0));
          return { fill: "var(--live)", opacity: 0.12 + 0.88 * p };
        }
      }
    },
    [byFips, mode],
  );

  const [hover, setHover] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 400 });
  const wrap = useRef<HTMLDivElement>(null);
  const hoverRow = hover ? byFips.get(hover) : undefined;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const b = wrap.current?.getBoundingClientRect();
    if (!b) return;
    setPos({ x: e.clientX - b.left, y: e.clientY - b.top, w: b.width });
  };

  const legend = useMemo(() => legendFor(mode), [mode]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          value={[mode]}
          onValueChange={(v) => {
            const next = v[0] as MapMode | undefined;
            if (next) onModeChange(next);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Map coloring mode"
        >
          {MODES.map((m) => (
            <ToggleGroupItem key={m.value} value={m.value} title={m.hint} className="text-xs">
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{legend}</div>
      </div>

      <div
        ref={wrap}
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={() => onSelect(hover && selected === hover ? null : hover)}
      >
        <CountyMap stateFips={stateFips} fill={fill} onHover={setHover} selected={selected} />
        {hoverRow && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-[3px] border border-border-strong bg-popover p-2.5 text-xs"
            style={{ left: Math.max(0, Math.min(pos.x + 14, pos.w - 230)), top: pos.y + 14 }}
            role="tooltip"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{hoverRow.name}</span>
              <span className="tnum text-muted-foreground">{hoverRow.pctIn != null ? `${Math.round(hoverRow.pctIn * 100)}% in` : "—"}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tnum">
              <dt className="text-muted-foreground">Votes in</dt>
              <dd className="text-right">{fmtVotes(hoverRow.votesIn)}</dd>
              <dt className="text-muted-foreground">Margin</dt>
              <dd className="text-right">{fmtMarginDR(hoverRow.margin)}</dd>
              <dt className="text-muted-foreground">2024 margin</dt>
              <dd className="text-right">{fmtMarginDR(hoverRow.margin2024)}</dd>
              <dt className="text-muted-foreground">Benchmark</dt>
              <dd className="text-right">{fmtMarginDR(hoverRow.benchmark)}</dd>
              <dt className="text-muted-foreground">Over/under</dt>
              <dd className={cn("text-right", ouColor(hoverRow.overUnder))}>{fmtOU(hoverRow.overUnder)}</dd>
              <dt className="text-muted-foreground">D needs of rest</dt>
              <dd className="text-right">{fmtNeeds(hoverRow.needs)}</dd>
            </dl>
            <div className="mt-1 text-xs text-muted-foreground">Click to pin in the table</div>
          </div>
        )}
      </div>
    </div>
  );
}

function legendFor(mode: MapMode) {
  if (mode === "pctin")
    return (
      <>
        <span>0%</span>
        <span className="flex gap-px">
          {[0.12, 0.34, 0.56, 0.78, 1].map((o) => (
            <i key={o} className="inline-block h-3 w-4 bg-signal" style={{ opacity: o }} />
          ))}
        </span>
        <span>100%</span>
      </>
    );
  const steps = [5, 4, 3, 2, 1] as const;
  return (
    <>
      <span className="text-party-r-ink">R</span>
      <span className="flex gap-px" aria-label="Margin ramp: landslide, safe, likely, lean, tilt">
        {steps.map((n) => (
          <Swatch key={`r${n}`} kind={`ramp-r-${n}`} className="h-3 w-3.5 rounded-none" />
        ))}
        {[...steps].reverse().map((n) => (
          <Swatch key={`d${n}`} kind={`ramp-d-${n}`} className="h-3 w-3.5 rounded-none" />
        ))}
      </span>
      <span className="text-party-d-ink">D</span>
      {mode === "swing" && <span className="ml-1">vs 2024 pres.</span>}
      {mode === "benchmark" && <span className="ml-1">vs tie benchmark</span>}
      <span className="ml-2 flex items-center gap-1">
        <Swatch kind="uncounted" /> not counted
      </span>
    </>
  );
}

export function fmtOU(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (Math.abs(v) < 0.05) return "0.0";
  return `${v > 0 ? "D" : "R"} +${Math.abs(v).toFixed(1)}`;
}

export function ouColor(v: number | undefined): string | undefined {
  if (v == null || Number.isNaN(v) || Math.abs(v) < 0.05) return undefined;
  return v > 0 ? "text-party-d-ink" : "text-party-r-ink";
}

export function fmtNeeds(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (v > 100) return "impossible";
  if (v < 0) return "locked";
  return fmtPct(v, 0);
}
