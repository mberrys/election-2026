/**
 * Projection-alignment check: district centroids (district layer) must fall
 * inside their own state in the us-atlas state layer. Both are in the same
 * planar frame, so this is plain point-in-polygon.
 */
import { readFile } from "node:fs/promises";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { geoIdentity, geoPath } from "d3-geo";
import { FIPS_TO_STATE } from "./constants";
import type { DistrictProps } from "./districts";

type Poly = Polygon | MultiPolygon;

function pointInRing(p: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPoly(p: Position, g: Poly): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const rs of polys) {
    if (!pointInRing(p, rs[0])) continue;
    if (rs.slice(1).some((hole) => pointInRing(p, hole))) continue;
    return true;
  }
  return false;
}

export interface AlignmentReport {
  checked: number;
  insideOwnState: number;
  insideAnyState: number;
  misses: { id: string; centroid: [number, number]; foundIn?: string }[];
  nc01: { centroid: [number, number]; insideNC: boolean } | null;
  districtBbox: number[];
  statesBbox: number[];
}

export async function checkAlignment(districtsPath: string, statesPath: string): Promise<AlignmentReport> {
  const dTopo = JSON.parse(await readFile(districtsPath, "utf8")) as Topology<{
    districts: GeometryCollection<DistrictProps>;
  }>;
  const sTopo = JSON.parse(await readFile(statesPath, "utf8")) as Topology<{
    states: GeometryCollection<{ name: string }>;
  }>;
  const districts = feature(dTopo, dTopo.objects.districts).features as Feature<Poly, DistrictProps>[];
  const states = feature(sTopo, sTopo.objects.states).features as Feature<Poly, { name: string }>[];
  const path = geoPath(geoIdentity());
  const byFips = new Map(states.map((s) => [String(s.id).padStart(2, "0"), s]));

  const report: AlignmentReport = {
    checked: 0,
    insideOwnState: 0,
    insideAnyState: 0,
    misses: [],
    nc01: null,
    districtBbox: path.bounds({ type: "FeatureCollection", features: districts }).flat(),
    statesBbox: path.bounds({ type: "FeatureCollection", features: states }).flat(),
  };

  for (const d of districts) {
    const c = path.centroid(d) as [number, number];
    // centroid of a concave district can fall outside it; use a point inside the
    // district itself when that happens (first ring vertex nudged inward is not
    // reliable, so fall back to the centroid of the largest ring).
    let probe: [number, number] = c;
    if (!pointInPoly(probe, d.geometry)) {
      const polys = d.geometry.type === "Polygon" ? [d.geometry.coordinates] : d.geometry.coordinates;
      const biggest = polys.reduce((a, b) => (Math.abs(path.area({ type: "Polygon", coordinates: b })) > Math.abs(path.area({ type: "Polygon", coordinates: a })) ? b : a));
      const ring = biggest[0];
      // midpoint of first interior diagonal found
      for (let i = 0; i < ring.length - 1 && !pointInPoly(probe, d.geometry); i += Math.max(1, Math.floor(ring.length / 50))) {
        const j = (i + Math.floor(ring.length / 2)) % (ring.length - 1);
        probe = [(ring[i][0] + ring[j][0]) / 2, (ring[i][1] + ring[j][1]) / 2];
      }
    }
    report.checked++;
    const own = byFips.get(d.properties.fips);
    const inOwn = !!own && pointInPoly(probe, own.geometry);
    if (inOwn) {
      report.insideOwnState++;
      report.insideAnyState++;
    } else {
      const found = states.find((s) => pointInPoly(probe, s.geometry));
      if (found) report.insideAnyState++;
      report.misses.push({
        id: d.properties.id,
        centroid: [Number(c[0].toFixed(2)), Number(c[1].toFixed(2))],
        foundIn: found ? FIPS_TO_STATE[String(found.id).padStart(2, "0")]?.abbr : undefined,
      });
    }
    if (d.properties.id === "house:NC-01") {
      report.nc01 = { centroid: [Number(c[0].toFixed(3)), Number(c[1].toFixed(3))], insideNC: inOwn };
    }
  }
  return report;
}
