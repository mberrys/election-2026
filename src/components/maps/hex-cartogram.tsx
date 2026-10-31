"use client";

import { useEffect, useMemo, useState } from "react";
import { geoIdentity, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { cn } from "@/lib/utils";

type DistrictProps = { id: string; state: string; cd: string; geoid?: string; label?: string };
type HexTopology = Topology & {
  centers?: Record<string, [number, number]>;
  layout?: { kind: string; version?: string; attribution?: string; url?: string; license?: string };
};

const W = 1000;

/**
 * 435-district cartogram from the Downballot/Daily Kos equal-area polygon hexmap (public/data/geo/hexmap-2026.json).
 * Planar frame x∈[0,1], y∈[0,~0.715]; rendered with geoIdentity().fitWidth.
 */
export function HexCartogram({
  fill,
  label,
  onSelect,
  onHover,
  selected,
  highlight,
  className,
  src = "/data/geo/hexmap-2026.json",
  showLabels = true,
}: {
  fill: (id: string) => string | null;
  label?: (id: string) => string;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  selected?: string | null;
  highlight?: (id: string) => boolean;
  className?: string;
  src?: string;
  showLabels?: boolean;
}) {
  const [topo, setTopo] = useState<HexTopology | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => r.json())
      .then((t: HexTopology) => alive && setTopo(t))
      .catch(() => alive && setTopo(null));
    return () => {
      alive = false;
    };
  }, [src]);

  const geo = useMemo(() => {
    if (!topo) return null;
    const districts = feature(topo, topo.objects.districts as GeometryCollection<DistrictProps>);
    const proj = geoIdentity().fitSize([W, W], districts as GeoPermissibleObjects);
    const path = geoPath(proj);
    const [[, y0], [, y1]] = path.bounds(districts as GeoPermissibleObjects);
    const stateBorders = topo.objects.states
      ? path(mesh(topo, topo.objects.states as GeometryCollection))
      : path(mesh(topo, topo.objects.districts as GeometryCollection, (a, b) => (a.properties as DistrictProps)?.state !== (b.properties as DistrictProps)?.state));
    const centers = Object.fromEntries(
      districts.features.map((f) => {
        const c = topo.centers?.[f.properties.id];
        const p = c ? proj(c) : path.centroid(f as GeoPermissibleObjects);
        return [f.properties.id, p as [number, number]];
      }),
    );
    const areas = districts.features.map((f) => path.area(f as GeoPermissibleObjects));
    const medianArea = areas.sort((a, b) => a - b)[Math.floor(areas.length / 2)] ?? 100;
    const fontSize = Math.max(5, Math.min(9, Math.sqrt(medianArea) * 0.45));
    return { districts, path, y0, height: y1 - y0, stateBorders, centers, fontSize };
  }, [topo]);

  if (!geo) return <div className={cn("aspect-[1.4] w-full animate-pulse rounded-md bg-muted/40", className)} />;

  return (
    <svg
      viewBox={`0 ${Math.floor(geo.y0)} ${W} ${Math.ceil(geo.height) + 1}`}
      className={cn("w-full h-auto select-none", className)}
      role="img"
      aria-label="House districts cartogram"
      onMouseLeave={() => onHover?.(null)}
    >
      <g>
        {geo.districts.features.map((f) => {
          const id = f.properties.id;
          const f0 = fill(id);
          const isSel = selected === id;
          const hl = highlight?.(id);
          return (
            <path
              key={id}
              d={geo.path(f as GeoPermissibleObjects) ?? undefined}
              fill={f0 ?? "var(--uncalled)"}
              fillOpacity={f0 ? 1 : 0.35}
              stroke={isSel ? "var(--foreground)" : "var(--background)"}
              strokeWidth={isSel ? 1.6 : 0.5}
              className={cn("cursor-pointer transition-[fill,fill-opacity] duration-500 hover:brightness-125", hl === false && "opacity-30")}
              onClick={() => onSelect?.(id)}
              onMouseEnter={() => onHover?.(id)}
            >
              <title>{label?.(id) ?? f.properties.label ?? `${f.properties.state}-${f.properties.cd}`}</title>
            </path>
          );
        })}
      </g>
      <path d={geo.stateBorders ?? undefined} fill="none" stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.1} strokeLinejoin="round" pointerEvents="none" />
      {showLabels && (
        <g pointerEvents="none" fontSize={geo.fontSize} fill="rgba(255,255,255,0.8)" textAnchor="middle" dominantBaseline="central" className="tnum">
          {geo.districts.features.map((f) => {
            const [x, y] = geo.centers[f.properties.id];
            return (
              <text key={f.properties.id} x={x} y={y}>
                {f.properties.cd === "AL" ? f.properties.state : Number(f.properties.cd)}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/** Hex layer attribution string (Downballot/Daily Kos CC BY 4.0). */
export const HEXMAP_ATTRIBUTION = "Cartogram: Daily Kos Elections / The Downballot (Daniel Donner), dkel.ec/map, CC BY 4.0";
