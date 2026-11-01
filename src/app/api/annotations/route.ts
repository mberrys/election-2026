import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonResponse, safeEqual } from "@/lib/http";
import { readSlow, writeSlow } from "@/lib/snapshot-store";
import { ANNOTATIONS, type Annotation } from "@/data/annotations";

export const maxDuration = 10;

/**
 * Election-night annotations without a redeploy (ballot seizure, court-ordered pause, set-aside order, or a
 * general "advisory"). Set `standing: "rejected"` once a court or
 * official has thrown a challenge out: it stays visible but no longer holds back calls.
 *
 *   GET  /api/annotations                       → { static: [...], runtime: [...] }
 *   POST /api/annotations  (Bearer ADMIN_SECRET) → replace the runtime list with the JSON array body
 *
 * The next ingest (≤1 min) attaches them to races; a pending `challengedBallots` immediately raises the bar for calls.
 */
const AnnotationSchema = z.object({
  raceId: z.string().optional(),
  state: z.string().length(2).optional(),
  offices: z.array(z.enum(["senate", "house", "governor", "ballot", "stateleg"])).optional(),
  kind: z.enum(["litigation", "set-aside", "count-paused", "advisory"]),
  summary: z.string().min(5).max(600),
  url: z.string().url().optional(),
  challengedBallots: z.number().int().nonnegative().optional(),
  standing: z.enum(["pending", "rejected"]).optional(),
  asOf: z.string(),
});

export async function GET(request: NextRequest) {
  const runtime = (await readSlow<Annotation[]>("annotations")) ?? [];
  return jsonResponse(request, { static: ANNOTATIONS, runtime }, { profile: "slow" });
}

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return jsonResponse(request, { error: "unauthorized" }, { status: 401, profile: "none" });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "body must be JSON" }, { status: 400, profile: "none" });
  }
  const parsed = z.array(AnnotationSchema).max(200).safeParse(body);
  if (!parsed.success) {
    return jsonResponse(request, { error: "invalid", issues: parsed.error.issues.slice(0, 5) }, { status: 400, profile: "none" });
  }
  const bad = parsed.data.filter((a) => !a.raceId && !a.state);
  if (bad.length) return jsonResponse(request, { error: "each annotation needs raceId or state" }, { status: 400, profile: "none" });
  await writeSlow("annotations", parsed.data);
  return jsonResponse(request, { ok: true, count: parsed.data.length }, { profile: "none" });
}
