import { getRedis } from "./redis";

const memory = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window counter. Uses Upstash Redis when configured so the limit holds across serverless instances,
 * otherwise a per-process map (local dev). Returns true when the call is allowed.
 */
export async function allow(key: string, limit: number, windowSec: number, now = Date.now()): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const k = `rl:${key}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, windowSec);
      return n <= limit;
    } catch {
      // Fall through to the in-memory limiter rather than failing the request.
    }
  }
  if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  cur.count += 1;
  return cur.count <= limit;
}
