/**
 * Point-wise replica of d3.geoAlbersUsa() at the us-atlas parameters
 * (scale 1300, translate [487.5, 305]).
 *
 * d3's composite picks the sub-projection by testing each one's clip extent.
 * We instead pick it by state FIPS (02 → Alaska inset, 15 → Hawaii inset,
 * everything else → lower 48), which gives identical coordinates for every
 * point that d3 would accept, and also projects points d3 would clip away
 * (the far Aleutians). Those are clipped afterwards in mapshaper using d3's
 * own inset extents, so the result matches us-atlas exactly.
 */
import { geoAlbers, geoAlbersUsa, geoConicEqualArea, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { US_ATLAS_PROJECTION } from "./constants";

const { scale: k, translate } = US_ATLAS_PROJECTION;
const [x, y] = translate;
const epsilon = 1e-6;

export const lower48: GeoProjection = geoAlbers().scale(k).translate([x, y]);
export const alaska: GeoProjection = geoConicEqualArea()
  .rotate([154, 0])
  .center([-2, 58.5])
  .parallels([55, 65])
  .scale(k * 0.35)
  .translate([x - 0.307 * k, y + 0.201 * k]);
export const hawaii: GeoProjection = geoConicEqualArea()
  .rotate([157, 0])
  .center([-3, 19.9])
  .parallels([8, 18])
  .scale(k)
  .translate([x - 0.205 * k, y + 0.212 * k]);

/** The reference composite, used only for self-checks. */
export const albersUsaReference: GeoProjection = geoAlbersUsa().scale(k).translate([x, y]);

/** d3's inset clip extents, as [xmin, ymin, xmax, ymax]. */
export const CLIP_EXTENTS = {
  lower48: [x - 0.455 * k, y - 0.238 * k, x + 0.455 * k, y + 0.238 * k],
  alaska: [x - 0.425 * k + epsilon, y + 0.120 * k + epsilon, x - 0.214 * k - epsilon, y + 0.234 * k - epsilon],
  hawaii: [x - 0.214 * k + epsilon, y + 0.166 * k + epsilon, x - 0.115 * k - epsilon, y + 0.234 * k - epsilon],
} as const;

export type Region = keyof typeof CLIP_EXTENTS;

export function regionForFips(fips: string): Region {
  if (fips === "02") return "alaska";
  if (fips === "15") return "hawaii";
  return "lower48";
}

export function projectionForRegion(region: Region): GeoProjection {
  return region === "alaska" ? alaska : region === "hawaii" ? hawaii : lower48;
}

function mapPositions(coords: unknown, fn: (p: Position) => Position): unknown {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === "number") return fn(coords as Position);
  return coords.map((c) => mapPositions(c, fn));
}

/** Project a lon/lat geometry to the us-atlas planar frame. */
export function projectGeometry(geom: Geometry, region: Region): Geometry {
  const proj = projectionForRegion(region);
  const fn = (p: Position): Position => {
    const out = proj([p[0], p[1]]);
    if (!out) throw new Error(`projection returned null for ${p[0]},${p[1]}`);
    return [out[0], out[1]];
  };
  if (geom.type === "GeometryCollection") {
    return { type: "GeometryCollection", geometries: geom.geometries.map((g) => projectGeometry(g, region)) };
  }
  return { ...geom, coordinates: mapPositions(geom.coordinates, fn) } as Geometry;
}

/** Project every feature; `fipsOf` says which inset a feature belongs to. */
export function projectFeatureCollection<P>(
  fc: FeatureCollection<Geometry, P>,
  fipsOf: (f: Feature<Geometry, P>) => string,
): FeatureCollection<Geometry, P> {
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      ...f,
      geometry: projectGeometry(f.geometry, regionForFips(fipsOf(f))),
    })),
  };
}

/**
 * Self-check: for a sample of lon/lat points, our per-region projection must
 * agree with d3.geoAlbersUsa wherever d3 accepts the point.
 */
export function checkAgainstReference(
  samples: { lonlat: Position; fips: string }[],
): { compared: number; maxDelta: number } {
  let compared = 0;
  let maxDelta = 0;
  for (const s of samples) {
    const ref = albersUsaReference([s.lonlat[0], s.lonlat[1]]);
    if (!ref) continue;
    const ours = projectionForRegion(regionForFips(s.fips))([s.lonlat[0], s.lonlat[1]]);
    if (!ours) throw new Error(`no projection for ${s.lonlat}`);
    compared++;
    maxDelta = Math.max(maxDelta, Math.hypot(ref[0] - ours[0], ref[1] - ours[1]));
  }
  return { compared, maxDelta };
}
