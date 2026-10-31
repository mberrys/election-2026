"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { divergingT, swingVs2024 } from "@/analytics";
import { CountyMap, marginFill } from "@/components/maps/county-map";
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

const D_BASE = "oklch(0.56 0.17 258";
const R_BASE = "oklch(0.58 0.2 25";

/** Diverging fill around 0: blue for +, red for −, neutral gray near centre. */
function divergingFill(v: number | undefined, range: number, pctIn?: number) {
  if (v == null || Number.isNaN(v)) return null;
  const t = divergingT(v, range);
  const strength = Math.abs(t - 0.5) * 2;
  const opacity = pctIn == null ? 1 : 0.35 + 0.65 * Math.min(1, pctIn);
  if (strength < 0.04) return { fill: "var(--uncalled)", opacity: Math.max(0.5, opacity) };
  const alpha = 0.2 + 0.8 * strength;
  return { fill: `${t > 0.5 ? D_BASE : R_BASE} / ${alpha.toFixed(2)})`, opacity };
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
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">{legend}</div>
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
            className="pointer-events-none absolute z-10 w-56 rounded-md border border-border bg-popover/95 p-2.5 text-xs shadow-lg backdrop-blur"
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
            <div className="mt-1 text-[10px] text-muted-foreground">Click to pin in the table</div>
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
        <span className="h-2 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, oklch(0.75 0.18 145 / 0.12), oklch(0.75 0.18 145))" }} />
        <span>100%</span>
      </>
    );
  const left = mode === "margin" ? "R+30" : "R+15";
  const right = mode === "margin" ? "D+30" : "D+15";
  return (
    <>
      <span className="text-party-r">{left}</span>
      <span className="h-2 w-24 rounded-sm" style={{ background: `linear-gradient(90deg, ${R_BASE}), var(--uncalled), ${D_BASE}))` }} />
      <span className="text-party-d">{right}</span>
      {mode === "swing" && <span className="ml-1 normal-case tracking-normal">vs 2024 pres.</span>}
      {mode === "benchmark" && <span className="ml-1 normal-case tracking-normal">vs tie benchmark</span>}
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
  return v > 0 ? "text-party-d" : "text-party-r";
}

export function fmtNeeds(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (v > 100) return "impossible";
  if (v < 0) return "locked";
  return fmtPct(v, 0);
}
