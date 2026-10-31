import type { NextRequest } from "next/server";
import { isAuthorizedCron, jsonResponse } from "@/lib/http";
import { refreshGenericBallot } from "@/data/slow";

export type { GenericBallotLive } from "@/data/slow";

export const maxDuration = 30;

/**
 * Manual / Pro-cron refresh of slow-moving context (generic ballot). On Hobby the ingest route refreshes it
 * automatically every 30 minutes, so no separate schedule is needed.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return jsonResponse(request, { error: "unauthorized" }, { status: 401, profile: "none" });
  try {
    const generic = await refreshGenericBallot();
    return jsonResponse(request, { ok: true, generic }, { profile: "none" });
  } catch (e) {
    return jsonResponse(request, { ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502, profile: "none" });
  }
}
