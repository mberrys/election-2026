import type { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { isAuthorizedCron, jsonResponse } from "@/lib/http";
import { submitIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/site";

/**
 * Tells IndexNow-enabled search engines (Bing and others) that every sitemap URL may have changed. Run it after a
 * deploy that ships new data (see docs/PINGER.md). Same bearer auth as /api/ingest.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) return jsonResponse(request, { error: "unauthorized" }, { status: 401, profile: "none" });

  if (new URL(SITE_URL).hostname === "localhost") {
    return jsonResponse(request, { error: "no public site URL: set NEXT_PUBLIC_SITE_URL" }, { status: 400, profile: "none" });
  }

  try {
    const result = await submitIndexNow(sitemap().map((e) => e.url));
    return jsonResponse(request, result, { status: result.ok ? 200 : 502, profile: "none" });
  } catch {
    return jsonResponse(request, { error: "IndexNow request failed" }, { status: 502, profile: "none" });
  }
}
