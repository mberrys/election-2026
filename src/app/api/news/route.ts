import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/http";
import { fetchRaceNews, type NewsPayload } from "@/lib/news";
import { allow } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";
import { getRace, getState } from "@/data/reference/load";

export const maxDuration = 20;

/** Server-side cache per race, so GDELT sees each race at most ~4x an hour however many viewers poll. */
const TTL_OK_SEC = 15 * 60;
/** Empty / failed lookups are retried sooner, but not on every request. */
const TTL_EMPTY_SEC = 2 * 60;
const MEMORY_MAX = 600;

const OK_CACHE = "public, s-maxage=600, stale-while-revalidate=1800";
const EMPTY_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

const memory = new Map<string, { at: number; ttlMs: number; payload: NewsPayload }>();
const inflight = new Map<string, Promise<NewsPayload>>();

const RACE_ID = /^[a-z]+:[A-Za-z0-9._-]{1,80}$/;

const ttlFor = (p: NewsPayload): number => (p.items.length > 0 ? TTL_OK_SEC : TTL_EMPTY_SEC);

async function readCached(key: string, now: number): Promise<NewsPayload | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const hit = await redis.get<NewsPayload>(key);
      if (hit && typeof hit === "object" && Array.isArray(hit.items)) return hit;
    } catch {
      // Fall through to the per-process cache.
    }
  }
  const mem = memory.get(key);
  if (mem && now - mem.at < mem.ttlMs) return mem.payload;
  return null;
}

async function writeCached(key: string, payload: NewsPayload, now: number): Promise<void> {
  const ttl = ttlFor(payload);
  if (memory.size >= MEMORY_MAX) {
    for (const [k, v] of memory) if (now - v.at >= v.ttlMs) memory.delete(k);
    // Still full: drop the oldest insertion.
    if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value as string);
  }
  memory.set(key, { at: now, ttlMs: ttl * 1000, payload });
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, payload, { ex: ttl });
    } catch {
      // Redis is an optimisation here; the in-memory copy still serves.
    }
  }
}

/**
 * GET /api/news?race=senate:GA  → { raceId, items[], source, fetchedAt, query }
 * Headlines about one race from GDELT (Google News RSS as fallback). Cached 15 min per race on the server and
 * 10 min on the CDN; per-IP rate limited. A total upstream failure is a 200 with `source: "none"` and no items.
 */
export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("race")?.trim() ?? "";
  if (!RACE_ID.test(raceId)) {
    return jsonResponse(request, { error: "race query parameter is required, e.g. ?race=senate:GA" }, { status: 400, profile: "none" });
  }
  const race = getRace(raceId);
  if (!race) return jsonResponse(request, { error: "not found", id: raceId }, { status: 404, profile: "none" });

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await allow(`news:${ip}`, 60, 60))) {
    return jsonResponse(request, { error: "Too many requests. Try again in a minute." }, { status: 429, profile: "none", extra: { "Retry-After": "60" } });
  }

  const key = `news:v1:${raceId}`;
  const now = Date.now();
  let payload = await readCached(key, now);
  if (!payload) {
    // Concurrent misses for one race share a single upstream call.
    let pending = inflight.get(key);
    if (!pending) {
      pending = fetchRaceNews(race, getState(race.state)?.name ?? race.state)
        .then(async (p) => {
          await writeCached(key, p, Date.now());
          return p;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    payload = await pending;
  }

  const cc = payload.items.length > 0 ? OK_CACHE : EMPTY_CACHE;
  return jsonResponse(request, payload, {
    profile: "slow",
    extra: { "Cache-Control": cc, "Vercel-CDN-Cache-Control": cc, "CDN-Cache-Control": cc },
  });
}
