/**
 * Drives a running dev server through a simulated night by calling /api/ingest every few seconds.
 *   SIMULATE=1 SIM_SPEED=30 npm run dev -- --port 3001   (in one terminal)
 *   SIM_URL=http://localhost:3001 npm run sim:drive       (in another)
 */
const base = process.env.SIM_URL ?? "http://localhost:3000";
const everyMs = Number(process.env.SIM_EVERY_MS ?? 5000);

async function tick() {
  try {
    const r = await fetch(`${base}/api/ingest?once=1`);
    const j = (await r.json()) as { ok: boolean; seq?: number; races?: number; skipped?: string; error?: string };
    console.log(new Date().toLocaleTimeString(), j.ok ? `seq ${j.seq} · ${j.races} races` : (j.skipped ?? j.error));
  } catch (e) {
    console.log("ingest failed:", e instanceof Error ? e.message : e);
  }
}

void tick();
setInterval(tick, everyMs);
