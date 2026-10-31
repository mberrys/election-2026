/**
 * Congressional districts for November 2026:
 *   TIGER/Line 2026 cd120 for 50 states + DC, except Missouri, whose HB 1 map
 *   was struck for 2026 (MO Supreme Court, Sept 3 2026) and is replaced with
 *   the 119th-Congress lines.
 *
 * Pipeline:
 *   1. mapshaper: read all zips in one topology, drop ZZ (water-only) records,
 *      simplify (visvalingam 8%, keep-shapes), export lon/lat GeoJSON.
 *   2. Node: project point-wise with the us-atlas Albers USA composite.
 *   3. mapshaper: clip insets to d3's extents, quantize, export TopoJSON.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mapshaper from "mapshaper";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import {
  APPORTIONMENT_2026,
  AT_LARGE_STATES,
  CB_2025_CD119_URL,
  FIPS_TO_STATE,
  STATES,
  TIGER_2025_MO_CD119_URL,
  TIGER_2026_CD_URL,
  US_ATLAS_PROJECTION,
} from "./constants";
import { downloadAll } from "./download";
import { checkAgainstReference, projectFeatureCollection } from "./projection";

export interface DistrictProps {
  state: string;
  fips: string;
  cd: string;
  geoid: string;
  id: string;
  delegate?: boolean;
}

interface RawProps {
  STATEFP: string;
  cd: string;
  GEOID: string;
  ALAND: number;
  AWATER: number;
}

export interface DistrictBuildResult {
  topologyPath: string;
  counts: Record<string, number>;
  total: number;
  delegates: string[];
  warnings: string[];
  checks: Record<string, unknown>;
  moSource: "tiger2025-cd119" | "cb2025-cd119";
}

const MO = "29";

function q(p: string): string {
  return `"${p.replace(/\\/g, "/")}"`;
}

export function districtIdFor(state: string, cd: string): { id: string; cd: string } {
  if (cd === "98") return { id: `house:${state}-AL`, cd: "AL" }; // DC delegate
  if (cd === "00" || AT_LARGE_STATES.has(state)) return { id: `house:${state}-AL`, cd: "AL" };
  return { id: `house:${state}-${cd.padStart(2, "0")}`, cd: cd.padStart(2, "0") };
}

function firstPosition(g: Geometry): Position | undefined {
  switch (g.type) {
    case "Polygon":
      return g.coordinates[0]?.[0];
    case "MultiPolygon":
      return g.coordinates[0]?.[0]?.[0];
    default:
      return undefined;
  }
}

async function readCsv(file: string): Promise<Record<string, string>[]> {
  const text = await readFile(file, "utf8");
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v])));
}

/** Compare MO's 2026 TIGER (HB 1) districts to the 119th lines by land area. */
async function compareMissouri(cache: string, mo2026: string, mo119: string): Promise<string[]> {
  const a = path.join(cache, "mo_cd120.csv");
  const b = path.join(cache, "mo_cd119.csv");
  await mapshaper.runCommands(
    `-i ${q(mo2026)} -filter-fields CD120FP,ALAND -rename-fields cd=CD120FP -o format=csv ${q(a)}`,
  );
  await mapshaper.runCommands(
    `-i ${q(mo119)} -filter 'STATEFP === "${MO}"' -filter-fields CD119FP,ALAND -rename-fields cd=CD119FP -o format=csv ${q(b)}`,
  );
  const land = (rows: Record<string, string>[]) =>
    new Map(rows.map((r) => [r.cd, Number(r.ALAND)]));
  const la = land(await readCsv(a));
  const lb = land(await readCsv(b));
  const diffs: string[] = [];
  for (const [cd, area] of la) {
    const other = lb.get(cd);
    if (other === undefined) {
      diffs.push(`MO-${cd} missing from 119th file`);
      continue;
    }
    const rel = Math.abs(area - other) / other;
    if (rel > 0.001) diffs.push(`MO-${cd} land area differs ${(rel * 100).toFixed(1)}%`);
  }
  return diffs;
}

export async function buildDistricts(opts: {
  cacheDir: string;
  outDir: string;
  /** us-atlas states-albers TopoJSON (contains the `nation` object used for shoreline clipping). */
  usAtlasStatesPath: string;
  log: (msg: string) => void;
}): Promise<DistrictBuildResult> {
  const { cacheDir, outDir, usAtlasStatesPath, log } = opts;
  const warnings: string[] = [];

  // 1. downloads
  const jobs = STATES.map((s) => ({
    url: TIGER_2026_CD_URL(s.fips),
    dest: path.join(cacheDir, `tl_2026_${s.fips}_cd120.zip`),
  }));
  const moTiger = path.join(cacheDir, "tl_2025_29_cd119.zip");
  const moCb = path.join(cacheDir, "cb_2025_us_cd119_500k.zip");
  let fetched = 0;
  await downloadAll(jobs, 6, (_j, f) => {
    if (f) fetched++;
  });
  log(`TIGER 2026: ${jobs.length} files (${fetched} fetched, ${jobs.length - fetched} cached)`);

  let moSource: DistrictBuildResult["moSource"] = "tiger2025-cd119";
  let moFile = moTiger;
  try {
    await downloadAll([{ url: TIGER_2025_MO_CD119_URL, dest: moTiger }]);
  } catch (e) {
    warnings.push(`TIGER 2025 MO cd119 unavailable (${(e as Error).message}); using cb_2025 500k`);
    moSource = "cb2025-cd119";
    moFile = moCb;
  }
  await downloadAll([{ url: CB_2025_CD119_URL, dest: moCb }]).catch((e: Error) => {
    if (moSource === "cb2025-cd119") throw e;
    warnings.push(`cb_2025 cd119 download failed (${e.message}); MO cross-check skipped`);
  });

  // Missouri: did TIGER 2026 ship a different (HB 1) map?
  const moDiffs = await compareMissouri(cacheDir, path.join(cacheDir, "tl_2026_29_cd120.zip"), moFile);
  if (moDiffs.length) {
    warnings.push(
      `Missouri: TIGER 2026 cd120 (HB 1) differs from the 119th-Congress map in ${moDiffs.length} of 8 districts; ` +
        `using 119th lines (${moSource}) because HB 1 was struck for Nov 2026 — verify before launch. ` +
        moDiffs.join("; "),
    );
  } else {
    warnings.push("Missouri: TIGER 2026 cd120 matches the 119th-Congress map by land area; no replacement was needed");
  }

  // 2. mapshaper pass 1: merge, filter, simplify, export lon/lat GeoJSON
  const inputs = jobs.map((j) => j.dest).filter((f) => !f.endsWith(`tl_2026_${MO}_cd120.zip`));
  inputs.push(moFile);
  const pass1 = path.join(cacheDir, "districts_pass1.geojson");
  const moFilter = moSource === "cb2025-cd119" ? ` -filter 'typeof CD119FP === "undefined" || STATEFP === "${MO}"'` : "";
  await mapshaper.runCommands(
    [
      `-i ${inputs.map(q).join(" ")} combine-files`,
      `-each 'cd = typeof CD120FP !== "undefined" ? CD120FP : CD119FP' target='*'`,
      `-merge-layers force name=districts`,
      moFilter,
      `-filter 'cd !== "ZZ"'`,
      `-filter-fields STATEFP,cd,GEOID,ALAND,AWATER`,
      `-simplify visvalingam 8% keep-shapes`,
      `-o format=geojson precision=0.000001 ${q(pass1)}`,
    ].join(" "),
  );

  // 3. project in Node
  const fc = JSON.parse(await readFile(pass1, "utf8")) as FeatureCollection<Geometry, RawProps>;
  const counts: Record<string, number> = {};
  const delegates: string[] = [];
  const seen = new Set<string>();
  const samples: { lonlat: Position; fips: string }[] = [];
  const typed: FeatureCollection<Geometry, DistrictProps> = {
    type: "FeatureCollection",
    features: fc.features.map((f: Feature<Geometry, RawProps>) => {
      const st = FIPS_TO_STATE[f.properties.STATEFP];
      if (!st) throw new Error(`unknown STATEFP ${f.properties.STATEFP}`);
      const { id, cd } = districtIdFor(st.abbr, f.properties.cd);
      if (seen.has(id)) throw new Error(`duplicate district ${id}`);
      seen.add(id);
      const delegate = st.abbr === "DC";
      if (delegate) delegates.push(st.abbr);
      else counts[st.abbr] = (counts[st.abbr] ?? 0) + 1;
      const p0 = firstPosition(f.geometry);
      if (p0) samples.push({ lonlat: p0, fips: st.fips });
      const props: DistrictProps = { state: st.abbr, fips: st.fips, cd, geoid: f.properties.GEOID, id };
      if (delegate) props.delegate = true;
      return { type: "Feature", id, properties: props, geometry: f.geometry };
    }),
  };
  const ref = checkAgainstReference(samples);
  if (ref.maxDelta > 1e-6) throw new Error(`projection mismatch vs d3.geoAlbersUsa: ${ref.maxDelta}`);
  const projected = projectFeatureCollection(typed, (f) => f.properties.fips);
  const pass2 = path.join(cacheDir, "districts_pass2.geojson");
  await writeFile(pass2, JSON.stringify(projected));

  // counts
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [st, n] of Object.entries(APPORTIONMENT_2026)) {
    if (counts[st] !== n) throw new Error(`${st}: TIGER has ${counts[st] ?? 0} districts, apportionment says ${n}`);
  }
  if (total !== 435) throw new Error(`district total ${total} != 435`);

  // 4. mapshaper pass 2: clip to the us-atlas nation outline (same frame), quantize, TopoJSON.
  //    TIGER districts include water out to the state line (Great Lakes, bays); us-atlas is
  //    clipped to the shoreline. Clipping to its `nation` polygon makes coasts coincide with the
  //    county layer and also enforces d3's inset extents (the nation outline lies within them).
  const nation = path.join(cacheDir, "us_atlas_nation.geojson");
  await mapshaper.runCommands(`-i ${q(usAtlasStatesPath)} -o target=nation format=geojson ${q(nation)}`);
  const out = path.join(outDir, "districts-2026.json");
  await mapshaper.runCommands(
    [
      `-i ${q(pass2)} name=districts`,
      `-clip ${q(nation)} remove-slivers`,
      `-filter-fields state,fips,cd,geoid,id,delegate`,
      `-sort 'id'`,
      `-o format=topojson quantization=${US_ATLAS_PROJECTION.quantization} bbox id-field=id ${q(out)}`,
    ].join(" "),
  );

  return {
    topologyPath: out,
    counts,
    total,
    delegates,
    warnings,
    moSource,
    checks: {
      projectionSelfCheck: { pointsCompared: ref.compared, maxDeltaPx: ref.maxDelta },
      featuresAfterZZFilter: fc.features.length,
    },
  };
}
