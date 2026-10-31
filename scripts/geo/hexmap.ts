/**
 * 435-district cartogram.
 *
 * Primary: The Downballot / Daily Kos Elections Congressional District Hexmap
 * v3.2 (2026). Despite the name it is not a regular hex grid: every district is
 * an equal-area polygon (7–185 vertices) arranged so states keep their shape.
 * We therefore ship the polygons themselves (TopoJSON) in a y-down frame
 * normalised to width 1, plus each district's centroid.
 *
 * Fallback (if Drive is unreachable): regular hexagons packed per state on the
 * NPR-style tile grid. Same file shape, `layout.kind = "fallback-hex-grid"`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mapshaper from "mapshaper";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { ABBR_TO_STATE, APPORTIONMENT_2026, AT_LARGE_STATES, DOWNBALLOT_HEXMAP } from "./constants";
import { download } from "./download";
import { buildStateTiles } from "./state-tiles";

export interface HexDistrictProps {
  id: string;
  state: string;
  cd: string;
  geoid: string;
  label: string;
}

export interface HexmapBuildResult {
  path: string;
  kind: "downballot-polygon-cartogram" | "fallback-hex-grid";
  version: string;
  warnings: string[];
}

type Poly = Polygon | MultiPolygon;

function q(p: string): string {
  return `"${p.replace(/\\/g, "/")}"`;
}

function rings(g: Poly): Position[][] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

function mapCoords(g: Poly, fn: (p: Position) => Position): Poly {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates.map((r) => r.map(fn)) };
  return { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map((r) => r.map(fn))) };
}

/** Planar area-weighted centroid of a (Multi)Polygon (outer rings only). */
function centroid(g: Poly): [number, number] {
  let A = 0;
  let cx = 0;
  let cy = 0;
  const outers = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  for (const r of outers) {
    for (let i = 0, n = r.length - 1; i < n; i++) {
      const [x0, y0] = r[i];
      const [x1, y1] = r[i + 1];
      const f = x0 * y1 - x1 * y0;
      A += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
  }
  if (A === 0) {
    const r = outers[0];
    return [r[0][0], r[0][1]];
  }
  return [cx / (3 * A), cy / (3 * A)];
}

function bbox(fcs: FeatureCollection<Poly>[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const fc of fcs)
    for (const f of fc.features)
      for (const r of rings(f.geometry))
        for (const [x, y] of r) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
  return [x0, y0, x1, y1];
}

function hexIdFor(state: string, label: string, geoid: string): { id: string; cd: string } {
  const cdRaw = geoid.slice(2);
  if (AT_LARGE_STATES.has(state) || cdRaw === "00" || !/^\d+$/.test(label)) {
    return { id: `house:${state}-AL`, cd: "AL" };
  }
  const cd = label.padStart(2, "0");
  return { id: `house:${state}-${cd}`, cd };
}

async function writeTopology(opts: {
  cacheDir: string;
  outPath: string;
  districts: FeatureCollection<Poly, HexDistrictProps>;
  states: FeatureCollection<Poly, { state: string }>;
  frame: { width: number; height: number };
  extra: Record<string, unknown>;
}): Promise<void> {
  const d = path.join(opts.cacheDir, "hex_districts_norm.geojson");
  const s = path.join(opts.cacheDir, "hex_states_norm.geojson");
  await writeFile(d, JSON.stringify(opts.districts));
  await writeFile(s, JSON.stringify(opts.states));
  const tmp = path.join(opts.cacheDir, "hexmap_topo.json");
  await mapshaper.runCommands(
    `-i ${q(d)} ${q(s)} combine-files -rename-layers districts,states ` +
      `-filter-fields id,state,cd,geoid,label target=districts -filter-fields state target=states ` +
      `-o target=* format=topojson quantization=1e4 bbox id-field=id ${q(tmp)}`,
  );
  const topo = JSON.parse(await readFile(tmp, "utf8")) as Record<string, unknown>;
  const centers: Record<string, [number, number]> = {};
  for (const f of opts.districts.features) {
    const [x, y] = centroid(f.geometry);
    centers[f.properties.id] = [Number(x.toFixed(5)), Number(y.toFixed(5))];
  }
  const out = {
    type: "Topology",
    layout: { width: 1, height: Number(opts.frame.height.toFixed(5)), yDown: true, ...opts.extra },
    centers,
    ...topo,
  };
  await writeFile(opts.outPath, JSON.stringify(out));
}

async function buildFromDownballot(cacheDir: string, outPath: string, warnings: string[]): Promise<HexmapBuildResult> {
  const dir = path.join(cacheDir, "downballot");
  const cdsZip = path.join(dir, `hex_cds_v${DOWNBALLOT_HEXMAP.version.replace(".", "")}.zip`);
  const stZip = path.join(dir, "hex_states.zip");
  await download(DOWNBALLOT_HEXMAP.files.cds, cdsZip);
  await download(DOWNBALLOT_HEXMAP.files.states, stZip);

  const cdsJson = path.join(dir, "hex_cds.geojson");
  const stJson = path.join(dir, "hex_states.geojson");
  await mapshaper.runCommands(`-i ${q(cdsZip)} -o format=geojson precision=0.000001 ${q(cdsJson)}`);
  await mapshaper.runCommands(`-i ${q(stZip)} -o format=geojson precision=0.000001 ${q(stJson)}`);

  type DkProps = { GEOID: string; STATEAB: string; STATENAME: string; CDLABEL: string };
  const cds = JSON.parse(await readFile(cdsJson, "utf8")) as FeatureCollection<Poly, DkProps>;
  const sts = JSON.parse(await readFile(stJson, "utf8")) as FeatureCollection<Poly, { STATEAB: string }>;
  if (cds.features.length !== 435) throw new Error(`Downballot hexmap has ${cds.features.length} districts, expected 435`);

  // The shapes are drawn in a pseudo-geographic frame; plot them planar (x = lon, y = lat).
  const [x0, y0, x1, y1] = bbox([cds, sts]);
  const w = x1 - x0;
  const norm = ([x, y]: Position): Position => [(x - x0) / w, (y1 - y) / w];

  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  const districts: FeatureCollection<Poly, HexDistrictProps> = {
    type: "FeatureCollection",
    features: cds.features.map((f: Feature<Poly, DkProps>) => {
      const state = f.properties.STATEAB;
      if (!ABBR_TO_STATE[state]) throw new Error(`hexmap: unknown state ${state}`);
      const { id, cd } = hexIdFor(state, f.properties.CDLABEL, f.properties.GEOID);
      if (seen.has(id)) throw new Error(`hexmap: duplicate ${id}`);
      seen.add(id);
      counts[state] = (counts[state] ?? 0) + 1;
      return {
        type: "Feature",
        id,
        properties: { id, state, cd, geoid: f.properties.GEOID, label: f.properties.CDLABEL },
        geometry: mapCoords(f.geometry, norm),
      };
    }),
  };
  for (const [st, n] of Object.entries(APPORTIONMENT_2026)) {
    if (counts[st] !== n) throw new Error(`hexmap: ${st} has ${counts[st] ?? 0} tiles, apportionment says ${n}`);
  }
  const states: FeatureCollection<Poly, { state: string }> = {
    type: "FeatureCollection",
    features: sts.features.map((f) => ({
      type: "Feature",
      id: f.properties.STATEAB,
      properties: { state: f.properties.STATEAB },
      geometry: mapCoords(f.geometry, norm),
    })),
  };

  await writeTopology({
    cacheDir,
    outPath,
    districts,
    states,
    frame: { width: 1, height: (y1 - y0) / w },
    extra: {
      kind: "downballot-polygon-cartogram",
      source: "The Downballot / Daily Kos Elections Congressional District Hexmap",
      version: DOWNBALLOT_HEXMAP.version,
      url: DOWNBALLOT_HEXMAP.pageUrl,
      license: DOWNBALLOT_HEXMAP.license,
      attribution: DOWNBALLOT_HEXMAP.attribution,
      note: "Equal-area district polygons, not a regular hex grid; coordinates are planar, width-normalised, y down.",
    },
  });
  warnings.push(
    "hexmap v3.2 (Downballot): AL, LA and MO tiles were not redrawn for their 2026/2022 maps; tile numbers still map 1:1 to district numbers.",
  );
  return { path: outPath, kind: "downballot-polygon-cartogram", version: DOWNBALLOT_HEXMAP.version, warnings };
}

/** Regular pointy-top hexagons packed per state tile (spiral from the tile centre). */
function buildFallback(cacheDir: string, outPath: string, warnings: string[]): Promise<HexmapBuildResult> {
  const grid = buildStateTiles();
  const cellW = 1 / grid.cols;
  const maxN = Math.max(...Object.values(APPORTIONMENT_2026));
  // hex radius so the largest state fits inside one cell
  const r = cellW / (Math.ceil(Math.sqrt(maxN)) * Math.sqrt(3) + 1);
  const dx = Math.sqrt(3) * r;
  const dy = 1.5 * r;
  const hexAt = (cx: number, cy: number): Polygon => ({
    type: "Polygon",
    coordinates: [
      Array.from({ length: 7 }, (_, i) => {
        const a = (Math.PI / 180) * (60 * i - 30);
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Position;
      }),
    ],
  });
  // axial spiral order (q, r) → sorted top-left→bottom-right for numbering
  const spiral = (n: number): [number, number][] => {
    const out: [number, number][] = [[0, 0]];
    const dirs: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (let ring = 1; out.length < n; ring++) {
      let qq = -ring, rr = ring;
      for (const [dq, dr] of dirs) {
        for (let s = 0; s < ring && out.length < n; s++) {
          out.push([qq, rr]);
          qq += dq;
          rr += dr;
        }
      }
    }
    return out;
  };
  const districts: FeatureCollection<Poly, HexDistrictProps> = { type: "FeatureCollection", features: [] };
  const states: FeatureCollection<Poly, { state: string }> = { type: "FeatureCollection", features: [] };
  for (const t of grid.tiles) {
    const n = APPORTIONMENT_2026[t.state];
    if (!n) continue;
    const cx = (t.col + 0.5) * cellW;
    const cy = (t.row + 0.5) * cellW;
    const cells = spiral(n)
      .map(([qa, ra]) => ({ x: cx + dx * (qa + ra / 2), y: cy + dy * ra }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    cells.forEach((c, i) => {
      const cd = n === 1 ? "AL" : String(i + 1).padStart(2, "0");
      const id = `house:${t.state}-${cd}`;
      districts.features.push({
        type: "Feature",
        id,
        properties: { id, state: t.state, cd, geoid: t.fips + (n === 1 ? "00" : cd), label: n === 1 ? t.state : String(i + 1) },
        geometry: hexAt(c.x, c.y),
      });
    });
    states.features.push({
      type: "Feature",
      id: t.state,
      properties: { state: t.state },
      geometry: {
        type: "Polygon",
        coordinates: [[[t.col * cellW, t.row * cellW], [(t.col + 1) * cellW, t.row * cellW], [(t.col + 1) * cellW, (t.row + 1) * cellW], [t.col * cellW, (t.row + 1) * cellW], [t.col * cellW, t.row * cellW]]],
      },
    });
  }
  warnings.push("hexmap: FALLBACK programmatic hex grid in use (Downballot download failed); districts are numbered top-left to bottom-right within each state tile and do not reflect real geography.");
  return writeTopology({
    cacheDir,
    outPath,
    districts,
    states,
    frame: { width: 1, height: grid.rows * cellW },
    extra: { kind: "fallback-hex-grid", source: "generated", version: "fallback", attribution: "Big Board (generated)" },
  }).then(() => ({ path: outPath, kind: "fallback-hex-grid" as const, version: "fallback", warnings }));
}

export async function buildHexmap(opts: { cacheDir: string; outDir: string; log: (m: string) => void }): Promise<HexmapBuildResult> {
  const outPath = path.join(opts.outDir, "hexmap-2026.json");
  const warnings: string[] = [];
  try {
    const r = await buildFromDownballot(opts.cacheDir, outPath, warnings);
    opts.log(`hexmap: Downballot v${r.version} polygons`);
    return r;
  } catch (e) {
    opts.log(`hexmap: Downballot source failed (${(e as Error).message}); generating fallback grid`);
    warnings.push(`Downballot hexmap unavailable: ${(e as Error).message}`);
    return buildFallback(opts.cacheDir, outPath, warnings);
  }
}
