/**
 * Loaders for the built geometry in public/data/geo/.
 *
 * - In the browser: fetch(`${baseUrl}/data/geo/<file>`) (baseUrl defaults to "").
 * - On the server (RSC, route handlers, scripts): read from `${process.cwd()}/public`
 *   unless a `baseUrl` is given, in which case it fetches like the client.
 *
 * Results are memoised per file for the life of the module.
 */
import type {
  CountiesTopology,
  DistrictsTopology,
  GeoFileName,
  GeoMeta,
  HexmapTopology,
  StatesTopology,
  StateTilesFile,
} from "./types";

export const GEO_PATH = "/data/geo";

const cache = new Map<string, Promise<unknown>>();

export interface LoadOptions {
  /** Origin or prefix to fetch from, e.g. "https://bigboard.example". Empty = same origin. */
  baseUrl?: string;
  /** Skip the in-memory cache. */
  fresh?: boolean;
}

async function readFromDisk(file: GeoFileName): Promise<unknown> {
  // Dynamic import keeps node:fs out of client bundles; the ignore comments stop
  // webpack/turbopack from trying to resolve it when this module is shared.
  const [{ readFile }, path] = await Promise.all([
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "node:fs/promises"),
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "node:path"),
  ]);
  const p = path.join(process.cwd(), "public", "data", "geo", file);
  return JSON.parse(await readFile(p, "utf8"));
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geo: GET ${url} -> ${res.status}`);
  return res.json();
}

export function loadGeoFile<T>(file: GeoFileName, opts: LoadOptions = {}): Promise<T> {
  const isServer = typeof window === "undefined";
  const key = `${opts.baseUrl ?? ""}|${file}`;
  if (!opts.fresh) {
    const hit = cache.get(key);
    if (hit) return hit as Promise<T>;
  }
  const p =
    isServer && opts.baseUrl === undefined
      ? readFromDisk(file)
      : fetchJson(`${opts.baseUrl ?? ""}${GEO_PATH}/${file}`);
  const typed = p as Promise<T>;
  cache.set(key, typed);
  typed.catch(() => cache.delete(key));
  return typed;
}

export const loadCounties = (opts?: LoadOptions) => loadGeoFile<CountiesTopology>("counties-10m.json", opts);
export const loadStates = (opts?: LoadOptions) => loadGeoFile<StatesTopology>("states-10m.json", opts);
export const loadDistricts = (opts?: LoadOptions) => loadGeoFile<DistrictsTopology>("districts-2026.json", opts);
export const loadHexmap = (opts?: LoadOptions) => loadGeoFile<HexmapTopology>("hexmap-2026.json", opts);
export const loadStateTiles = (opts?: LoadOptions) => loadGeoFile<StateTilesFile>("state-tiles.json", opts);
export const loadGeoMeta = (opts?: LoadOptions) => loadGeoFile<GeoMeta>("meta.json", opts);

/** Everything the national board needs, in parallel. */
export async function loadBoardGeometry(opts?: LoadOptions) {
  const [states, districts, hexmap, tiles] = await Promise.all([
    loadStates(opts),
    loadDistricts(opts),
    loadHexmap(opts),
    loadStateTiles(opts),
  ]);
  return { states, districts, hexmap, tiles };
}
