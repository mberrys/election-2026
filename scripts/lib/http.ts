import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR, USER_AGENT, info, sleep, warn } from "./util";

export interface FetchOptions {
  /** Minimum ms between requests to the same host (politeness). */
  minSpacingMs?: number;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Retries on 5xx/network error. */
  retries?: number;
  /** Default wait on 429 when no Retry-After header (ms). */
  rateLimitWaitMs?: number;
  /** Max 429 waits before giving up. */
  maxRateLimitWaits?: number;
  /** Bypass reading from cache (still writes). */
  noCache?: boolean;
  /** Skip caching of this response entirely. */
  skipCache?: boolean;
  /** Label for logs. */
  label?: string;
}

export interface FetchResult {
  url: string;
  status: number;
  ok: boolean;
  body: string;
  contentType: string;
  fromCache: boolean;
  fetchedAt: string;
}

let globalNoCache = false;
export function setNoCache(v: boolean): void {
  globalNoCache = v;
}

const lastRequestByHost = new Map<string, number>();
const httpDir = path.join(CACHE_DIR, "http");

/** Cache key from the URL minus any api_key, so credentials never feed the hash (and rotating a key keeps the cache). */
function cacheKey(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("api_key");
  return crypto.createHash("sha256").update(u.href).digest("hex");
}

function readCache(url: string): FetchResult | undefined {
  const k = cacheKey(url);
  const meta = path.join(httpDir, `${k}.meta.json`);
  const body = path.join(httpDir, `${k}.body`);
  if (!fs.existsSync(meta) || !fs.existsSync(body)) return undefined;
  try {
    const m = JSON.parse(fs.readFileSync(meta, "utf8")) as Omit<FetchResult, "body" | "fromCache">;
    return { ...m, body: fs.readFileSync(body, "utf8"), fromCache: true };
  } catch {
    return undefined;
  }
}

function writeCache(r: FetchResult): void {
  fs.mkdirSync(httpDir, { recursive: true });
  const k = cacheKey(r.url);
  fs.writeFileSync(path.join(httpDir, `${k}.body`), r.body, "utf8");
  const meta = { url: r.url, status: r.status, ok: r.ok, contentType: r.contentType, fetchedAt: r.fetchedAt };
  fs.writeFileSync(path.join(httpDir, `${k}.meta.json`), JSON.stringify(meta), "utf8");
}

/** Cached, throttled, retrying fetch. Only 2xx responses are cached (keyed by URL hash). */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const noCache = opts.noCache ?? globalNoCache;
  if (!noCache && !opts.skipCache) {
    const c = readCache(url);
    if (c) return c;
  }
  const host = new URL(url).host;
  const spacing = opts.minSpacingMs ?? 400;
  const retries = opts.retries ?? 3;
  const maxRl = opts.maxRateLimitWaits ?? 8;
  let attempt = 0;
  let rlWaits = 0;
  for (;;) {
    const last = lastRequestByHost.get(host) ?? 0;
    const wait = last + spacing - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestByHost.set(host, Date.now());
    let res: Response | undefined;
    let err: unknown;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...(opts.headers ?? {}) },
        redirect: "follow",
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      err = e;
    }
    if (res) {
      const body = await res.text();
      const out: FetchResult = {
        url,
        status: res.status,
        ok: res.ok,
        body,
        contentType: res.headers.get("content-type") ?? "",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };
      if (res.ok) {
        if (!opts.skipCache) writeCache(out);
        return out;
      }
      if (res.status === 429 && rlWaits < maxRl) {
        const ra = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : (opts.rateLimitWaitMs ?? 60_000);
        info(`429 from ${host} (${opts.label ?? url}); waiting ${Math.round(waitMs / 1000)}s`);
        await sleep(waitMs);
        rlWaits++;
        continue;
      }
      if (res.status >= 500 && attempt < retries) {
        attempt++;
        await sleep(1500 * attempt);
        continue;
      }
      return out;
    }
    if (attempt < retries) {
      attempt++;
      await sleep(1500 * attempt);
      continue;
    }
    warn(`fetch failed for ${url}: ${(err as Error)?.message ?? String(err)}`);
    return { url, status: 0, ok: false, body: "", contentType: "", fromCache: false, fetchedAt: new Date().toISOString() };
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<{ data: T | undefined; res: FetchResult }> {
  const res = await fetchText(url, opts);
  if (!res.ok) return { data: undefined, res };
  try {
    return { data: JSON.parse(res.body) as T, res };
  } catch (e) {
    warn(`invalid JSON from ${url}: ${(e as Error).message}`);
    return { data: undefined, res };
  }
}

// ---------- MediaWiki ----------

const WIKI_API = "https://en.wikipedia.org/w/api.php";

export interface WikiPage {
  title: string;
  pageid: number;
  revid?: number;
  wikitext: string;
}

interface ParseEnvelope {
  error?: { code: string; info: string };
  parse?: { title: string; pageid: number; revid?: number; wikitext: string };
}

/** Fetch a page's wikitext via action=parse, serially, honouring maxlag. */
export async function fetchWikitext(page: string, opts: FetchOptions = {}): Promise<WikiPage | undefined> {
  const url =
    `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}` +
    `&prop=wikitext|revid&format=json&formatversion=2&redirects=1&maxlag=5`;
  const noCache = opts.noCache ?? globalNoCache;
  if (!noCache) {
    const c = readCache(url);
    if (c) {
      try {
        const d = JSON.parse(c.body) as ParseEnvelope;
        if (d.parse) return { title: d.parse.title, pageid: d.parse.pageid, revid: d.parse.revid, wikitext: d.parse.wikitext };
      } catch {
        /* fall through to refetch */
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    const res = await fetchText(url, { minSpacingMs: 600, label: `wiki:${page}`, ...opts, skipCache: true });
    if (!res.ok) {
      warn(`Wikipedia fetch failed for "${page}" (HTTP ${res.status})`);
      return undefined;
    }
    let data: ParseEnvelope;
    try {
      data = JSON.parse(res.body) as ParseEnvelope;
    } catch {
      warn(`Wikipedia returned non-JSON for "${page}"`);
      return undefined;
    }
    if (data.error) {
      if (data.error.code === "maxlag") {
        info(`maxlag on "${page}", waiting 5s`);
        await sleep(5000);
        continue;
      }
      warn(`Wikipedia error for "${page}": ${data.error.code} ${data.error.info}`);
      return undefined;
    }
    if (data.parse) {
      writeCache(res);
      return { title: data.parse.title, pageid: data.parse.pageid, revid: data.parse.revid, wikitext: data.parse.wikitext };
    }
  }
  warn(`Wikipedia maxlag retries exhausted for "${page}"`);
  return undefined;
}
