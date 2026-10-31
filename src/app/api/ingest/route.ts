import type { NextRequest } from "next/server";
import { after } from "next/server";
import { isAuthorizedCron, jsonResponse } from "@/lib/http";
import { runIngest } from "@/data/ingest";
import { refreshSlowIfStale } from "@/data/slow";

export const maxDuration = 120;

/**
 * Ingest trigger. Called once a minute by an external pinger on Hobby (cron-job.org; see docs/PINGER.md) or by
 * Vercel Cron on Pro, with `Authorization: Bearer $CRON_SECRET` (or `?key=`).
 *
 * Each call runs INGEST_PULLS_PER_RUN pulls (default 2) on a fixed grid INGEST_PULL_GAP_MS apart (default 30 s),
 * measured from the start of the call, so a 1/min trigger gives updates at :00 and :30. The first pull's result
 * is returned right away (pingers time out after ~30 s); later pulls and the 30-minute generic-ballot refresh run
 * in `after()`. Overlapping calls are harmless: the Redis lock skips a pull that would collide.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return jsonResponse(request, { error: "unauthorized" }, { status: 401, profile: "none" });

  const startedAt = Date.now();
  const pulls = Math.max(1, Math.min(4, Number(process.env.INGEST_PULLS_PER_RUN ?? 2)));
  const gapMs = Math.max(10_000, Number(process.env.INGEST_PULL_GAP_MS ?? 30_000));
  const once = request.nextUrl.searchParams.get("once") === "1";

  const first = await runIngest({ reason: "trigger" });

  after(async () => {
    await refreshSlowIfStale();
    if (once || pulls < 2) return;
    for (let i = 1; i < pulls; i++) {
      const wait = startedAt + i * gapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      await runIngest({ reason: `trigger+${i * Math.round(gapMs / 1000)}s` });
    }
  });

  return jsonResponse(request, { ...first, nextPullsIn: once ? [] : Array.from({ length: pulls - 1 }, (_, i) => (i + 1) * gapMs) }, { profile: "none" });
}
