/**
 * Build the Big Board map geometry into public/data/geo/.
 *
 *   npx tsx scripts/build-geometry.ts
 *
 * Outputs: counties-10m.json, states-10m.json (us-atlas, Albers USA projected),
 * districts-2026.json (TIGER 2026 cd120, MO from the 119th-Congress lines),
 * hexmap-2026.json (Downballot v3.2 cartogram), state-tiles.json, meta.json.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import {
  APPORTIONMENT_2026,
  CB_2025_CD119_URL,
  DOWNBALLOT_HEXMAP,
  TIGER_2025_MO_CD119_URL,
  US_ATLAS_PROJECTION,
} from "./geo/constants";
import { buildDistricts } from "./geo/districts";
import { buildHexmap } from "./geo/hexmap";
import { buildStateTiles } from "./geo/state-tiles";
import { checkAlignment } from "./geo/verify";

const require = createRequire(path.join(process.cwd(), "package.json"));

function findRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "node_modules", "us-atlas"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("run from the repo root (package.json + node_modules/us-atlas not found)");
}

const ROOT = findRoot(process.cwd());
const CACHE = path.join(ROOT, "scripts", ".cache", "geo");
const OUT = path.join(ROOT, "public", "data", "geo");

const t0 = Date.now();
const log = (m: string) => console.log(`[geo +${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

async function sizes(file: string): Promise<{ raw: number; gzip: number }> {
  const buf = await readFile(file);
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
}
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  await mkdir(CACHE, { recursive: true });
  await writeFile(path.join(CACHE, ".gitignore"), "*\n");
  await mkdir(OUT, { recursive: true });
  const warnings: string[] = [];

  // 1. us-atlas (projected variants; the "states" object is kept in counties)
  const usAtlasPkg = require("us-atlas/package.json") as { version: string };
  const usAtlasDir = path.dirname(require.resolve("us-atlas/package.json"));
  const countiesOut = path.join(OUT, "counties-10m.json");
  const statesOut = path.join(OUT, "states-10m.json");
  await copyFile(path.join(usAtlasDir, "counties-albers-10m.json"), countiesOut);
  await copyFile(path.join(usAtlasDir, "states-albers-10m.json"), statesOut);
  log(`us-atlas ${usAtlasPkg.version}: copied counties-albers-10m -> counties-10m.json, states-albers-10m -> states-10m.json`);

  // 2. districts
  const d = await buildDistricts({ cacheDir: CACHE, outDir: OUT, usAtlasStatesPath: statesOut, log });
  warnings.push(...d.warnings);
  log(`districts: ${d.total} voting districts + delegates [${d.delegates.join(",")}] (MO from ${d.moSource})`);

  // 3. hexmap + state tiles
  const hex = await buildHexmap({ cacheDir: CACHE, outDir: OUT, log });
  warnings.push(...hex.warnings);
  const tiles = buildStateTiles();
  await writeFile(path.join(OUT, "state-tiles.json"), JSON.stringify(tiles));

  // 4. alignment check
  const align = await checkAlignment(d.topologyPath, statesOut);
  log(
    `alignment: ${align.insideOwnState}/${align.checked} district probes inside own us-atlas state` +
      (align.misses.length ? `; misses: ${align.misses.map((m) => `${m.id}${m.foundIn ? `→${m.foundIn}` : ""}`).join(", ")}` : "") +
      `; NC-01 centroid ${align.nc01?.centroid.join(",")} insideNC=${align.nc01?.insideNC}`,
  );
  if (!align.nc01?.insideNC) throw new Error("alignment check failed: NC-01 centroid not inside NC");
  if (align.insideOwnState / align.checked < 0.98) throw new Error("alignment check failed: too many districts outside their state");
  if (align.misses.length) warnings.push(`alignment: ${align.misses.length} district probe(s) outside own state: ${align.misses.map((m) => m.id).join(", ")}`);

  // 5. sizes + meta
  const files = ["counties-10m.json", "states-10m.json", "districts-2026.json", "hexmap-2026.json", "state-tiles.json"];
  const fileSizes: Record<string, { raw: number; gzip: number }> = {};
  for (const f of files) fileSizes[f] = await sizes(path.join(OUT, f));
  const dz = fileSizes["districts-2026.json"].gzip;
  if (dz > 1.5 * 1024 * 1024) warnings.push(`districts-2026.json is ${kb(dz)} gzipped (> 1.5 MB target)`);

  const meta = {
    builtAt: new Date().toISOString(),
    projection: {
      name: "d3.geoAlbersUsa",
      scale: US_ATLAS_PROJECTION.scale,
      translate: US_ATLAS_PROJECTION.translate,
      viewport: US_ATLAS_PROJECTION.viewport,
      note: "All planar layers (counties, states, districts) share this frame and overlay directly.",
    },
    sources: [
      {
        name: "us-atlas (counties-albers-10m, states-albers-10m)",
        url: "https://github.com/topojson/us-atlas",
        license: "ISC",
        version: usAtlasPkg.version,
        note: "Census cartographic boundaries 2017; pre-projected to Albers USA 975x610.",
      },
      {
        name: "Census TIGER/Line 2026, 120th Congressional Districts (tl_2026_{ss}_cd120)",
        url: "https://www2.census.gov/geo/tiger/TIGER2026/CD/",
        license: "Public domain (US Census Bureau)",
        version: "TIGER2026 (files dated 2026-10-06)",
      },
      d.moSource === "tiger2025-cd119"
        ? {
            name: "Census TIGER/Line 2025, 119th Congressional Districts, Missouri (tl_2025_29_cd119)",
            url: TIGER_2025_MO_CD119_URL,
            license: "Public domain (US Census Bureau)",
            version: "TIGER2025",
            note: "Used for MO instead of TIGER 2026 (HB 1 struck for 2026). Same 119th lines as cb_2025_us_cd119_500k at full resolution.",
          }
        : {
            name: "Census cartographic boundary 2025, 119th Congressional Districts (cb_2025_us_cd119_500k), Missouri",
            url: CB_2025_CD119_URL,
            license: "Public domain (US Census Bureau)",
            version: "GENZ2025",
            note: "Used for MO instead of TIGER 2026 (HB 1 struck for 2026).",
          },
      {
        name: hex.kind === "fallback-hex-grid" ? "Generated fallback hex grid" : "The Downballot / Daily Kos Elections Congressional District Hexmap",
        url: DOWNBALLOT_HEXMAP.pageUrl,
        license: hex.kind === "fallback-hex-grid" ? "n/a" : DOWNBALLOT_HEXMAP.license,
        version: hex.version,
        attribution: hex.kind === "fallback-hex-grid" ? undefined : DOWNBALLOT_HEXMAP.attribution,
      },
    ],
    districtCounts: Object.fromEntries(Object.keys(APPORTIONMENT_2026).sort().map((st) => [st, d.counts[st]])),
    totalDistricts: d.total,
    delegates: d.delegates,
    missouriSource: d.moSource,
    hexmap: { kind: hex.kind, version: hex.version },
    files: fileSizes,
    checks: { ...d.checks, alignment: align },
    warnings,
  };
  await writeFile(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));

  for (const f of [...files, "meta.json"]) {
    const s = fileSizes[f] ?? (await sizes(path.join(OUT, f)));
    log(`${f.padEnd(22)} ${kb(s.raw).padStart(8)} raw ${kb(s.gzip).padStart(8)} gzip`);
  }
  for (const w of warnings) log(`WARN ${w}`);
  const st = await stat(path.join(OUT, "meta.json"));
  log(`done; meta.json ${st.size} bytes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
