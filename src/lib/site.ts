/**
 * Canonical site origin, no trailing slash. Order: NEXT_PUBLIC_SITE_URL, then Vercel's production domain (so preview
 * deployments canonicalise to production rather than to themselves), then localhost for local dev.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

export const SITE_URL = siteUrl();

export const SITE_NAME = "Big Board 2026";

export const DEFAULT_TITLE = "Big Board: 2026 Midterms";

export const ELECTION_DAY_LABEL = "Tuesday, November 3, 2026";

export const SITE_DESCRIPTION =
  "Live, free-data election tracker for the Nov 3, 2026 US midterms: Senate, House, governors and ballot measures with county-level expected-vote analysis.";

/** Absolute URL for a site path ("/history" -> "https://example.com/history"). */
export function absoluteUrl(path: string, base: string = SITE_URL): string {
  return path === "/" || path === "" ? base : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
