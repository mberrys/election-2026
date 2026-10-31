import { describe, expect, it } from "vitest";
import { runAdapters, type Adapter } from "../../src/data/adapters/types";
import { adapters, adapterById } from "../../src/data/adapters/registry";
import { assembleRace } from "../../src/data/adapters/util/race";
import { fixtureFetch, makeCtx } from "./helpers";

function okAdapter(id: string, state: string): Adapter {
  return {
    id,
    tier: "A",
    states: [state],
    cadenceSec: 60,
    async fetch(ctx) {
      return [
        assembleRace({
          id: `senate:${state}`,
          office: "senate",
          state,
          name: `${state} Senate`,
          candidates: [
            { id: "a", name: "A", party: "D", votes: 60, pct: 0 },
            { id: "b", name: "B", party: "R", votes: 40, pct: 0 },
          ],
          source: { adapter: id, tier: "A" },
          ctx,
        }),
      ];
    },
  };
}

describe("runAdapters", () => {
  it("isolates throwing and hanging adapters, validates races, reports per-feed status", async () => {
    const hang: Adapter = {
      id: "hang",
      tier: "B",
      states: ["XX"],
      cadenceSec: 60,
      fetch: (ctx) =>
        new Promise((_, reject) => {
          ctx.signal.addEventListener("abort", () => reject(ctx.signal.reason));
        }),
    };
    const boom: Adapter = {
      id: "boom",
      tier: "A",
      states: ["YY"],
      cadenceSec: 60,
      fetch: async () => {
        throw new Error("upstream 503");
      },
    };
    const invalid: Adapter = {
      id: "invalid",
      tier: "C",
      states: ["ZZ"],
      cadenceSec: 60,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: async () => [{ id: "nope" } as any],
    };
    const ctx = makeCtx(fixtureFetch([]));
    const t0 = Date.now();
    const { races, feeds } = await runAdapters(
      [okAdapter("ok1", "NC"), hang, boom, invalid, okAdapter("ok2", "GA")],
      { fetch: ctx.fetch, now: ctx.now, metas: ctx.metas, log: ctx.log },
      { timeoutMs: 200, concurrency: 2 },
    );
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(races.map((r) => r.id).sort()).toEqual(["senate:GA", "senate:NC"]);
    expect(races[0]?.marginDR).toBe(20);
    expect(races[0]?.leaderId).toBe("a");
    const by = Object.fromEntries(feeds.map((f) => [f.adapter, f]));
    expect(by.ok1).toMatchObject({ ok: true, racesUpdated: 1, tier: "A", states: ["NC"] });
    expect(by.ok1?.lastOkAt).toBe(ctx.now.toISOString());
    expect(by.hang).toMatchObject({ ok: false, racesUpdated: 0 });
    expect(by.hang?.lastError).toMatch(/timed out/);
    expect(by.boom?.lastError).toMatch(/upstream 503/);
    expect(by.invalid).toMatchObject({ ok: true, racesUpdated: 0 });
    expect(ctx.logs.some((l) => /\[invalid\] dropped invalid race/.test(l))).toBe(true);
    expect(feeds.every((f) => typeof f.latencyMs === "number")).toBe(true);
  });

  it("registry lists the tier A adapters and keeps nyt-xcheck out unless enabled", () => {
    const ids = adapters.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["nc-ncsbe", "ev-va", "ev-ga", "ca-sos", "mn-sos", "ak-doe", "clarity-ia", "wikipedia-results"]));
    if (process.env.ENABLE_NYT_XCHECK !== "1") expect(ids).not.toContain("nyt-xcheck");
    expect(adapterById.get("nc-ncsbe")?.states).toEqual(["NC"]);
    expect(adapters.filter((a) => a.tier === "A").length).toBe(7);
  });
});
