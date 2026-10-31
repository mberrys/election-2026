import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/http";
import { getRedis } from "@/lib/redis";
import { readNational } from "@/lib/snapshot-store";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const redis = getRedis();
  const national = await readNational();
  const ageSec = national?.generatedAt ? Math.round((Date.now() - new Date(national.generatedAt).getTime()) / 1000) : null;
  return jsonResponse(
    request,
    {
      ok: true,
      redis: redis ? "upstash" : "memory",
      snapshotSeq: national?.seq ?? 0,
      snapshotAgeSec: ageSec,
      feeds: national?.feeds ?? [],
      notices: national?.notices ?? [],
    },
    { profile: "none" },
  );
}
