"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { geoIdentity, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { cn } from "@/lib/utils";
import { HatchPattern } from "@/components/board/hatch";

/** Fill tokens a `fill` callback may return besides a CSS colour. null and var(--uncalled) also draw the neutral hatch. */
export const HEX_HATCH = "hatch";
/** Uncalled but rated toward a party: hatched in that party's colour. */
export const HEX_HATCH_D = "hatch-d";
export const HEX_HATCH_R = "hatch-r";

/** Overlay marks: `dot` = leading (full party colour on a dark tint fill); `flipFrom` = the old holder's colour as a top marker. */
export type HexMark = { dot?: string; flipFrom?: string };

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
  mark,
}: {
  fill: (id: string) => string | null;
  mark?: (id: string) => HexMark | null;
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
  const uid = useId().replace(/:/g, "");
  const pat = { [HEX_HATCH]: `${uid}-h`, [HEX_HATCH_D]: `${uid}-hd`, [HEX_HATCH_R]: `${uid}-hr` } as const;
  const paint = (f0: string | null) =>
    f0 == null || f0 === "var(--uncalled)" || f0 === HEX_HATCH
      ? `url(#${pat[HEX_HATCH]})`
      : f0 === HEX_HATCH_D || f0 === HEX_HATCH_R
        ? `url(#${pat[f0]})`
        : f0;
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
    const tops = Object.fromEntries(districts.features.map((f) => [f.properties.id, path.bounds(f as GeoPermissibleObjects)[0][1]]));
    const unit = Math.sqrt(medianArea);
    return { districts, path, y0, height: y1 - y0, stateBorders, centers, fontSize, tops, unit };
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
      <defs>
        <HatchPattern id={pat[HEX_HATCH]} pitch={5} />
        <HatchPattern id={pat[HEX_HATCH_D]} pitch={5} line="var(--party-d-muted)" ground="var(--s1)" />
        <HatchPattern id={pat[HEX_HATCH_R]} pitch={5} line="var(--party-r-muted)" ground="var(--s1)" />
      </defs>
      <g>
        {geo.districts.features.map((f) => {
          const id = f.properties.id;
          const isSel = selected === id;
          const hl = highlight?.(id);
          return (
            <path
              key={id}
              d={geo.path(f as GeoPermissibleObjects) ?? undefined}
              fill={paint(fill(id))}
              stroke={isSel ? "var(--foreground)" : "var(--background)"}
              strokeWidth={isSel ? 1.6 : 0.5}
              className={cn("cursor-pointer anim-map hover:brightness-125", hl === false && "opacity-30")}
              onClick={() => onSelect?.(id)}
              onMouseEnter={() => onHover?.(id)}
            >
              <title>{label?.(id) ?? f.properties.label ?? `${f.properties.state}-${f.properties.cd}`}</title>
            </path>
          );
        })}
      </g>
      {mark && (
        <g pointerEvents="none">
          {geo.districts.features.map((f) => {
            const id = f.properties.id;
            const m = mark(id);
            if (!m || (!m.dot && !m.flipFrom)) return null;
            const [x, y] = geo.centers[id];
            const top = geo.tops[id];
            const s = geo.unit * 0.22;
            const dim = highlight?.(id) === false ? 0.3 : 1;
            return (
              <g key={id} opacity={dim}>
                {m.flipFrom && <path d={`M${x} ${top + 0.6}L${x + s} ${top + s * 1.1}L${x - s} ${top + s * 1.1}Z`} fill={m.flipFrom} />}
                {m.dot && <circle cx={x} cy={showLabels ? y + geo.unit * 0.3 : y} r={geo.unit * (showLabels ? 0.1 : 0.13)} fill={m.dot} />}
              </g>
            );
          })}
        </g>
      )}
      <path d={geo.stateBorders ?? undefined} fill="none" stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.1} strokeLinejoin="round" pointerEvents="none" />
      {showLabels && (
        <g
          pointerEvents="none"
          fontSize={geo.fontSize}
          fill="var(--ink)"
          stroke="var(--ground)"
          strokeWidth={geo.fontSize * 0.22}
          paintOrder="stroke"
          textAnchor="middle"
          dominantBaseline="central"
          className="tnum"
        >
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
