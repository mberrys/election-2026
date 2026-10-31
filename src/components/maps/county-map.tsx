"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { cn } from "@/lib/utils";
import { HatchPattern, rampColor } from "@/components/board/hatch";

type CountyProps = { name?: string };
type Fill = (fips: string) => { fill: string; opacity?: number } | null;

/**
 * SVG county choropleth for one state from us-atlas counties-10m (pre-projected Albers USA, 975×610 frame).
 * Fits the state's bounding box into the viewBox. `fill(fips)` decides color. The whole state sits on a hatch
 * (uncounted), so a county with no fill stays hatched and a partly counted one lets the hatch show through its opacity.
 */
export function CountyMap({
  stateFips,
  fill,
  onHover,
  selected,
  className,
  topologyUrl = "/data/geo/counties-10m.json",
}: {
  stateFips: string;
  fill: Fill;
  onHover?: (fips: string | null) => void;
  selected?: string | null;
  className?: string;
  topologyUrl?: string;
}) {
  const [topo, setTopo] = useState<Topology | null>(null);
  const hatchId = `${useId().replace(/:/g, "")}-hatch`;
  useEffect(() => {
    let alive = true;
    fetch(topologyUrl)
      .then((r) => r.json())
      .then((t: Topology) => alive && setTopo(t))
      .catch(() => alive && setTopo(null));
    return () => {
      alive = false;
    };
  }, [topologyUrl]);

  const geo = useMemo(() => {
    if (!topo) return null;
    const counties = feature(topo, topo.objects.counties as GeometryCollection<CountyProps>);
    const mine = counties.features.filter((f) => String(f.id).padStart(5, "0").startsWith(stateFips));
    if (!mine.length) return null;
    const path = geoPath(); // geometry is already projected
    const fc = { type: "FeatureCollection", features: mine } as GeoPermissibleObjects;
    const [[x0, y0], [x1, y1]] = path.bounds(fc);
    const borders = mesh(
      topo,
      topo.objects.counties as GeometryCollection,
      (a, b) =>
        a !== b &&
        String(a.id).padStart(5, "0").startsWith(stateFips) &&
        String(b.id).padStart(5, "0").startsWith(stateFips),
    );
    const outline = path(fc);
    // ~110 hatch lines across the state whatever its size, so small and large states read the same.
    const pitch = Math.max(x1 - x0, y1 - y0) / 110;
    return { mine, path, viewBox: `${x0 - 2} ${y0 - 2} ${x1 - x0 + 4} ${y1 - y0 + 4}`, borders, outline, pitch };
  }, [topo, stateFips]);

  if (!geo) return <div className={cn("aspect-[4/3] w-full animate-pulse rounded-md bg-muted/40", className)} />;

  return (
    <svg viewBox={geo.viewBox} className={cn("w-full h-auto", className)} role="img" aria-label="County results map">
      <defs>
        <HatchPattern id={hatchId} pitch={geo.pitch} />
      </defs>
      <path d={geo.outline ?? undefined} fill={`url(#${hatchId})`} pointerEvents="none" />
      {geo.mine.map((f) => {
        const fips = String(f.id).padStart(5, "0");
        const style = fill(fips);
        return (
          <path
            key={fips}
            d={geo.path(f as GeoPermissibleObjects) ?? undefined}
            fill={style && style.fill !== "var(--uncalled)" ? style.fill : "transparent"}
            fillOpacity={style?.opacity ?? 1}
            stroke={selected === fips ? "var(--foreground)" : "none"}
            strokeWidth={selected === fips ? 1.5 : 0}
            className="anim-map cursor-pointer hover:brightness-125"
            onMouseEnter={() => onHover?.(fips)}
            onMouseLeave={() => onHover?.(null)}
          >
            <title>{f.properties?.name ?? fips}</title>
          </path>
        );
      })}
      <path d={geo.path(geo.borders) ?? undefined} fill="none" stroke="var(--background)" strokeWidth={0.6} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * D/R margin on the 5-step ramp (tilt <2, lean 2–5, likely 5–10, safe 10–20, landslide 20+ pts).
 * Opacity follows the share counted, so the hatch underneath shows how much of the county is still out.
 */
export function marginFill(marginDR: number | undefined | null, pctIn?: number) {
  if (marginDR == null || Number.isNaN(marginDR)) return null;
  const opacity = pctIn == null ? 1 : 0.35 + 0.65 * Math.min(1, pctIn);
  return { fill: rampColor(marginDR), opacity };
}
