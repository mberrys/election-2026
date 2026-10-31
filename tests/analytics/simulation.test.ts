import { describe, expect, it } from "vitest";

// Regression: a full simulated election night must never retract a projection.
describe("simulated election night", () => {
  it("makes no retractions and finishes with most races projected", async () => {
    process.env.SIMULATE = "1";
    process.env.SIM_SPEED = "1";
    const START = Date.parse("2026-11-03T23:45:00Z");
    process.env.SIM_START = new Date(START).toISOString();
    const { runIngest } = await import("../../src/data/ingest");
    const { readNational } = await import("../../src/lib/snapshot-store");
    const RealDate = Date;
    const called = new Map<string, string>();
    let retractions = 0;
    let projected = 0;
    try {
      for (let mins = 0; mins <= 7 * 60; mins += 60) {
        const fake = START + mins * 60_000;
        globalThis.Date = class extends RealDate {
          constructor(...args: unknown[]) {
            if (args.length === 0) super(fake);
            else super(...(args as [string]));
          }
          static now() {
            return fake;
          }
        } as DateConstructor;
        await runIngest({ reason: "test", timeoutMs: 120_000 });
        globalThis.Date = RealDate;
        const snap = await readNational();
        projected = snap?.races.filter((r) => r.projection).length ?? 0;
        for (const r of snap?.races ?? []) {
          const prev = called.get(r.id);
          if (prev && prev !== r.projection?.party) retractions++;
          if (r.projection) called.set(r.id, r.projection.party);
        }
      }
    } finally {
      globalThis.Date = RealDate;
      delete process.env.SIMULATE;
    }
    expect(retractions).toBe(0);
    expect(projected).toBeGreaterThan(350);
  }, 60_000);
});
