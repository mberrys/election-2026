import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { z } from "zod";
import { RaceMeta as RaceMetaSchema, type RaceMeta } from "../../src/data/schema";
import type { AdapterCtx } from "../../src/data/adapters/types";

export const FIXTURES = resolve(__dirname, "../../fixtures");

export function fixture(rel: string): string {
  return readFileSync(resolve(FIXTURES, rel), "utf8");
}
export function fixtureBytes(rel: string): Buffer {
  return readFileSync(resolve(FIXTURES, rel));
}

export type Route = [match: string | RegExp, body: string | Buffer | { status: number; body?: string }];

/**
 * fetch stub: first matching route wins (string = exact URL or suffix match,
 * RegExp = test). Unmatched URLs return 404. Records every URL requested.
 */
export function fixtureFetch(routes: Route[]): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    for (const [m, body] of routes) {
      const hit = typeof m === "string" ? url === m || url.endsWith(m) : m.test(url);
      if (!hit) continue;
      if (typeof body === "object" && !Buffer.isBuffer(body) && "status" in body) {
        return new Response(body.body ?? "", { status: body.status });
      }
      return new Response(body as BodyInit, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

export function makeCtx(
  fetchImpl: typeof fetch,
  metas: RaceMeta[] = [],
  now = new Date("2026-11-03T20:00:00Z"),
): AdapterCtx & { logs: string[] } {
  const logs: string[] = [];
  return {
    fetch: fetchImpl,
    now,
    signal: new AbortController().signal,
    log: (m) => logs.push(m),
    metas: new Map(metas.map((m) => [m.id, m])),
    logs,
  };
}

/** Build a RaceMeta from zod input (defaults such as `incumbent: false` are filled by the schema). */
export function meta(input: z.input<typeof RaceMetaSchema>): RaceMeta {
  return RaceMetaSchema.parse(input);
}

export function sumVotes(votes: Record<string, number>): number {
  return Object.values(votes).reduce((s, v) => s + v, 0);
}
