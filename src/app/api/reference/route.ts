import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/http";
import { readSlow } from "@/lib/snapshot-store";
import type { GenericBallotLive } from "../ingest-slow/route";

export const maxDuration = 10;

/** Slow-lane context refreshed by /api/ingest-slow (generic ballot). Null fields fall back to build-time data. */
export async function GET(request: NextRequest) {
  const generic = await readSlow<GenericBallotLive>("generic");
  return jsonResponse(request, { generic }, { profile: "slow" });
}
