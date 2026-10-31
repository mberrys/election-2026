import { createHash } from "node:crypto";

export type CacheProfile = "live" | "slow" | "static" | "none";

const PROFILES: Record<CacheProfile, string> = {
  // Election-night hot path: CDN holds 15s, serves stale for 60s while revalidating; browser 5s.
  live: "public, max-age=5, s-maxage=15, stale-while-revalidate=60",
  slow: "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
  static: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  none: "private, no-store",
};

/** JSON response with CDN cache headers + ETag/304 handling. */
export function jsonResponse(
  request: Request,
  body: unknown,
  { profile = "live", status = 200, extra = {} }: { profile?: CacheProfile; status?: number; extra?: Record<string, string> } = {},
): Response {
  const text = JSON.stringify(body);
  const etag = `"${createHash("sha1").update(text).digest("base64url")}"`;
  const headers: Record<string, string> = {
    "Cache-Control": PROFILES[profile],
    "Vercel-CDN-Cache-Control": PROFILES[profile],
    "CDN-Cache-Control": PROFILES[profile],
    ETag: etag,
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
  if (status === 200 && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(text, { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}

export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("key") === secret;
}
