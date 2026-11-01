"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
type StateProps = { state: string };
type HexTopology = Topology & {
  centers?: Record<string, [number, number]>;
  layout?: { kind: string; version?: string; attribution?: string; url?: string; license?: string };
};

const W = 1000;
/**
 * State labels render at this CSS size, and only when a median district (≈ unit wide × 1.4) is big enough on screen
 * to hold two letters at that size: about 1440px desktop and up.
 */
const LABEL_PX = 12.5;
const LABEL_MIN_UNIT_PX = 18;

/**
 * 435-district cartogram from the Downballot/Daily Kos equal-area polygon hexmap (public/data/geo/hexmap-2026.json).
 * Planar frame x∈[0,1], y∈[0,~0.715]; rendered with geoIdentity().fitWidth.
 *
 * No district numbers are drawn (they could never render at a readable size); `showLabels` adds two-letter state
 * labels, sized in screen pixels and dropped entirely when the map renders too small for them. With `onSelect`, the
 * districts are keyboard reachable as one tab stop (arrow keys move, Enter pins) and focus reports through `onHover`.
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
  showLabels = false,
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
  /** Two-letter state labels, when they fit at 12px or more. */
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
    const tops = Object.fromEntries(districts.features.map((f) => [f.properties.id, path.bounds(f as GeoPermissibleObjects)[0][1]]));
    const unit = Math.sqrt(medianArea);
    const ids = districts.features.map((f) => f.properties.id);

    // One label per state, on the district centre nearest the state's centroid so it always sits inside the state.
    const byState = new Map<string, string[]>();
    for (const f of districts.features) byState.set(f.properties.state, [...(byState.get(f.properties.state) ?? []), f.properties.id]);
    const stateCentroids = new Map<string, [number, number]>();
    if (topo.objects.states) {
      for (const f of feature(topo, topo.objects.states as GeometryCollection<StateProps>).features)
        stateCentroids.set(f.properties.state, path.centroid(f as GeoPermissibleObjects) as [number, number]);
    }
    const stateLabels = [...byState.entries()].map(([st, list]) => {
      const pts = list.map((id) => centers[id]);
      const c = stateCentroids.get(st) ?? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
      let best = list[0];
      let bestD = Infinity;
      for (const id of list) {
        const [x, y] = centers[id];
        const dd = (x - c[0]) ** 2 + (y - c[1]) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = id;
        }
      }
      return { state: st, at: best, xy: centers[best] };
    });
    const labelAt = new Set(stateLabels.map((l) => l.at));
    return { districts, path, y0, height: y1 - y0, stateBorders, centers, tops, unit, ids, stateLabels, labelAt };
  }, [topo]);

  // Rendered pixels per SVG unit, so labels can be set in screen pixels and dropped when the map is too small.
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxPerUnit, setPxPerUnit] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !showLabels) return;
    const ro = new ResizeObserver(([e]) => setPxPerUnit(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [geo, showLabels]);

  const interactive = !!onSelect;
  const [cursor, setCursor] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  if (!geo) return <div className={cn("aspect-[1.4] w-full animate-pulse rounded-md bg-muted/40", className)} />;

  const labelsOn = showLabels && pxPerUnit > 0 && geo.unit * pxPerUnit >= LABEL_MIN_UNIT_PX;
  const labelSize = labelsOn ? LABEL_PX / pxPerUnit : 0;
  const tabStop = (selected && geo.centers[selected] ? selected : null) ?? cursor ?? geo.ids[0];

  const focusDistrict = (id: string) => {
    svgRef.current?.querySelector<SVGPathElement>(`[data-district="${CSS.escape(id)}"]`)?.focus();
  };
  const onKey = (e: React.KeyboardEvent, id: string) => {
    const i = geo.ids.indexOf(id);
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? geo.ids[Math.min(geo.ids.length - 1, i + 1)]
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? geo.ids[Math.max(0, i - 1)]
          : e.key === "Home"
            ? geo.ids[0]
            : e.key === "End"
              ? geo.ids[geo.ids.length - 1]
              : null;
    if (next) {
      e.preventDefault();
      focusDistrict(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(id);
    }
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 ${Math.floor(geo.y0)} ${W} ${Math.ceil(geo.height) + 1}`}
      className={cn("h-auto w-full select-none", className)}
      role={interactive ? "group" : "img"}
      aria-label={interactive ? "House districts map. Use the arrow keys to move between districts and Enter to pin one." : "House districts cartogram"}
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
          const ring = isSel || focused === id;
          const hl = highlight?.(id);
          const text = label?.(id) ?? f.properties.label ?? `${f.properties.state}-${f.properties.cd}`;
          return (
            <path
              key={id}
              data-district={id}
              d={geo.path(f as GeoPermissibleObjects) ?? undefined}
              fill={paint(fill(id))}
              stroke={ring ? "var(--foreground)" : "var(--background)"}
              strokeWidth={ring ? 1.8 : 0.5}
              className={cn("anim-map cursor-pointer outline-none hover:brightness-125", hl === false && "opacity-30")}
              onClick={() => onSelect?.(id)}
              onMouseEnter={() => onHover?.(id)}
              {...(interactive && {
                tabIndex: id === tabStop ? 0 : -1,
                role: "button",
                "aria-label": text,
                "aria-pressed": isSel,
                onFocus: () => {
                  setCursor(id);
                  setFocused(id);
                  onHover?.(id);
                },
                onBlur: () => {
                  setFocused((cur) => (cur === id ? null : cur));
                  onHover?.(null);
                },
                onKeyDown: (e: React.KeyboardEvent) => onKey(e, id),
              })}
            >
              {!interactive && <title>{text}</title>}
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
            // A district carrying its state's label keeps the dot below the text.
            const below = labelsOn && geo.labelAt.has(id);
            return (
              <g key={id} opacity={dim}>
                {m.flipFrom && <path d={`M${x} ${top + 0.6}L${x + s} ${top + s * 1.1}L${x - s} ${top + s * 1.1}Z`} fill={m.flipFrom} />}
                {m.dot && <circle cx={x} cy={below ? y + geo.unit * 0.3 : y} r={geo.unit * (below ? 0.1 : 0.13)} fill={m.dot} />}
              </g>
            );
          })}
        </g>
      )}
      <path d={geo.stateBorders ?? undefined} fill="none" stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.1} strokeLinejoin="round" pointerEvents="none" />
      {labelsOn && (
        <g
          pointerEvents="none"
          aria-hidden
          fontSize={labelSize}
          fontWeight={600}
          fill="var(--ink)"
          stroke="var(--ground)"
          strokeWidth={labelSize * 0.28}
          strokeLinejoin="round"
          paintOrder="stroke"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {geo.stateLabels.map((l) => (
            <text key={l.state} x={l.xy[0]} y={l.xy[1]}>
              {l.state}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

/** Hex layer attribution string (Downballot/Daily Kos CC BY 4.0). */
export const HEXMAP_ATTRIBUTION = "Cartogram: Daily Kos Elections / The Downballot (Daniel Donner), dkel.ec/map, CC BY 4.0";
