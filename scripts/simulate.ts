/**
 * Offline election-night rehearsal: runs the full ingest (simulator adapter → analytics → balance) at a
 * series of sim-clock checkpoints and prints how the night unfolds. No server or Redis needed.
 *
 *   npx tsx scripts/simulate.ts                 # checkpoints every 30 sim-minutes, 6:45 PM → 2 AM ET
 *   SIM_SEED=7 npx tsx scripts/simulate.ts      # a different night
 *
 * For a live browser rehearsal instead: SIMULATE=1 SIM_SPEED=30 npm run dev, then hit /api/ingest every
 * few seconds (or `npm run sim:drive`).
 */
process.env.SIMULATE = "1";
process.env.SIM_SPEED = "1";

const START = Date.parse("2026-11-03T23:45:00Z");

async function main() {
  const { runIngest } = await import("../src/data/ingest");
  const { readNational } = await import("../src/lib/snapshot-store");
  process.env.SIM_START = new Date(START).toISOString();

  // Freeze Date.now / new Date() at each checkpoint so sim time == wall time with SIM_SPEED=1.
  const RealDate = Date;
  const called = new Map<string, string>();
  let retractions = 0;
  for (let mins = 0; mins <= 7 * 60 + 15; mins += 30) {
    const fake = START + mins * 60_000;
    globalThis.Date = class extends RealDate {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        if (args.length === 0) super(fake);
        else super(...(args as [string]));
      }
      static now() {
        return fake;
      }
    } as DateConstructor;

    const res = await runIngest({ reason: `sim+${mins}m`, timeoutMs: 120_000 });
    const snap = await readNational();
    globalThis.Date = RealDate;
    if (!res.ok || !snap) {
      console.log(`+${mins}m ingest failed`, res.error ?? res.skipped);
      continue;
    }
    for (const r of snap.races) {
      const prev = called.get(r.id);
      const now = r.projection?.party;
      if (prev && prev !== now) {
        retractions++;
        console.log(`  RETRACTED ${r.id}: was ${prev}, now ${now ?? "uncalled"} (status ${r.status}, pct ${r.pctExpected?.toFixed(3)}, margin ${r.marginPts?.toFixed(2)})`);
      }
      if (now) called.set(r.id, now);
    }
    const watch = (process.env.SIM_WATCH ?? "").split(",").filter(Boolean);
    const { readState } = await import("../src/lib/snapshot-store");
    const etW = new RealDate(fake - 5 * 3600_000).toISOString().slice(11, 16);
    for (const id of watch) {
      const r = snap.races.find((x) => x.id === id);
      if (!r) continue;
      const st = await readState(r.state);
      const full = st?.races.find((x) => x.id === id);
      const fulton = full?.units.find((u) => u.fips === "13121");
      console.log(`    ${etW} ${id}: ${r.status}${r.projection ? " → " + r.projection.party : ""} · ${((r.pctExpected ?? 0) * 100).toFixed(0)}% in · ${r.candidates.slice(0, 3).map((c) => `${c.name.split(" ").slice(-2).join(" ")} ${c.pct}%`).join(" / ")}${r.flags?.length ? " · ⚖ " + r.flags.map((f) => f.kind).join(",") : ""}${fulton ? ` · Fulton ${((fulton.pctExpected ?? 0) * 100).toFixed(0)}%` : ""}`);
    }
    for (const n of snap.notices.filter((x) => x.includes("stalled"))) console.log(`    ⚠ ${n}`);
    const et = new RealDate(fake - 5 * 3600_000).toISOString().slice(11, 16);
    const s = snap.balance.senate;
    const h = snap.balance.house;
    const counting = snap.races.filter((r) => r.status === "counting").length;
    const projected = snap.races.filter((r) => r.status === "projected").length;
    const runoff = snap.races.filter((r) => r.status === "runoff").length;
    const sen = (p: "D" | "R") => s.notUp[p] + s.called[p] + (p === "D" ? s.notUp.I + s.called.I : 0);
    console.log(
      `${et} ET  Senate D ${sen("D")} R ${sen("R")}  | House D ${h.called.D} R ${h.called.R}  | projected ${projected}, counting ${counting}, runoff ${runoff}`,
    );
  }
  console.log(`retractions: ${retractions}`);
  const fin = await readNational();
  console.log(`watch: ${(fin?.watch ?? []).map((w) => `${w.state}${w.reasons.length ? ` [${w.reasons.join(", ")}]` : ""}`).join("  ")}`);
  const final = await readNational();
  const ga = final?.races.find((r) => r.id === "senate:GA");
  if (ga) console.log(`GA Senate: ${ga.status} ${ga.candidates.map((c) => `${c.name} ${c.pct}%`).join(" / ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
