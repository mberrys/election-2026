/**
 * Types for the build-time geometry in public/data/geo/ (see scripts/build-geometry.ts).
 *
 * All planar layers share the us-atlas frame:
 *   d3.geoAlbersUsa().scale(1300).translate([487.5, 305]) in a 975×610 viewport.
 * Render them with d3.geoPath(d3.geoIdentity()) (or a geoIdentity().fitSize) and
 * they overlay exactly: counties, states, nation and 2026 districts.
 */
import type { GeometryCollection, Topology } from "topojson-specification";

export const GEO_VIEWPORT = { width: 975, height: 610 } as const;

/** us-atlas counties-albers-10m: objects counties, states, nation. */
export type CountiesTopology = Topology<{
  counties: GeometryCollection<{ name: string }>;
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection<Record<string, never>>;
}>;

/** us-atlas states-albers-10m: objects states, nation. */
export type StatesTopology = Topology<{
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection<Record<string, never>>;
}>;

export interface DistrictProperties {
  /** Postal abbreviation, e.g. "NC" (also "DC" for the delegate seat). */
  state: string;
  /** State FIPS, e.g. "37". */
  fips: string;
  /** Two-digit district number ("01") or "AL" for at-large seats and the DC delegate. */
  cd: string;
  /** Census GEOID, e.g. "3701" (at-large "0200", DC "1198"). */
  geoid: string;
  /** Race id, `house:NC-01` / `house:AK-AL` (see raceId in src/data/schema.ts). */
  id: string;
  /** Present and true only for non-voting delegate seats (DC). */
  delegate?: boolean;
}

/** districts-2026.json: 435 voting districts + DC delegate, same frame as us-atlas. Geometry ids equal `properties.id`. */
export type DistrictsTopology = Topology<{
  districts: GeometryCollection<DistrictProperties>;
}>;

export interface HexDistrictProperties {
  id: string;
  state: string;
  cd: string;
  geoid: string;
  /** Label as drawn on the source map ("1", "12", or the state abbreviation for at-large). */
  label: string;
}

export type HexmapKind = "downballot-polygon-cartogram" | "fallback-hex-grid";

/**
 * hexmap-2026.json: a TopoJSON with extra top-level keys.
 * Coordinates are planar, x in [0, 1], y in [0, layout.height], y down.
 * The Downballot map is an equal-area polygon cartogram, not a regular hex grid;
 * use `centers` for labels/tooltips and the `districts` object for the shapes.
 */
export type HexmapTopology = Topology<{
  districts: GeometryCollection<HexDistrictProperties>;
  states: GeometryCollection<{ state: string }>;
}> & {
  layout: {
    width: 1;
    height: number;
    yDown: true;
    kind: HexmapKind;
    source: string;
    version: string;
    url?: string;
    license?: string;
    attribution: string;
    note?: string;
  };
  /** district id → [x, y] centroid in layout units. */
  centers: Record<string, [number, number]>;
};

export interface StateTile {
  state: string;
  name: string;
  fips: string;
  col: number;
  row: number;
}

/** state-tiles.json: 50 states + DC on a 12×8 grid (NPR-style layout). */
export interface StateTilesFile {
  cols: number;
  rows: number;
  tiles: StateTile[];
}

export interface GeoSource {
  name: string;
  url: string;
  license: string;
  version: string;
  note?: string;
  attribution?: string;
}

export interface GeoMeta {
  builtAt: string;
  projection: {
    name: string;
    scale: number;
    translate: [number, number];
    viewport: [number, number];
    note: string;
  };
  sources: GeoSource[];
  /** Voting districts per state (sums to 435; DC excluded). */
  districtCounts: Record<string, number>;
  totalDistricts: number;
  delegates: string[];
  missouriSource: "tiger2025-cd119" | "cb2025-cd119";
  hexmap: { kind: HexmapKind; version: string };
  files: Record<string, { raw: number; gzip: number }>;
  checks: Record<string, unknown>;
  warnings: string[];
}

export type GeoFileName =
  | "counties-10m.json"
  | "states-10m.json"
  | "districts-2026.json"
  | "hexmap-2026.json"
  | "state-tiles.json"
  | "meta.json";

/**
 * Seats per state for the 2026 House elections (2020 apportionment).
 * Derived from the TIGER 2026 cd120 files; the build asserts equality. Sums to 435.
 */
export const DISTRICT_COUNTS_2026 = {
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14,
  HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8,
  MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12,
  NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7,
  SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1,
} as const satisfies Record<string, number>;

export type StateAbbr = keyof typeof DISTRICT_COUNTS_2026;

export const TOTAL_HOUSE_SEATS = 435;

export const AT_LARGE_STATES: ReadonlySet<StateAbbr> = new Set(
  (Object.keys(DISTRICT_COUNTS_2026) as StateAbbr[]).filter((s) => DISTRICT_COUNTS_2026[s] === 1),
);

/** All 435 race ids in state/district order: house:AL-01 … house:WY-AL. */
export function allHouseRaceIds(): string[] {
  const ids: string[] = [];
  for (const st of Object.keys(DISTRICT_COUNTS_2026) as StateAbbr[]) {
    const n = DISTRICT_COUNTS_2026[st];
    if (n === 1) ids.push(`house:${st}-AL`);
    else for (let i = 1; i <= n; i++) ids.push(`house:${st}-${String(i).padStart(2, "0")}`);
  }
  return ids;
}
