import { Race, type FeedStatus, type RaceMeta, type Tier } from "../schema";

/**
 * Live-results adapter contract.
 *
 * An adapter pulls one upstream feed (or one jurisdiction of a generic feed),
 * normalizes it to `Race[]` and tags every race with `source`. Adapters never
 * throw across the `runAdapters` boundary: each one runs under its own timeout
 * and error isolation, so a dead state feed degrades one state, not the board.
 */

export interface AdapterCtx {
  /** Injected fetch (tests pass a fixture stub). Already bound to `signal` by `runAdapters`. */
  fetch: typeof fetch;
  /** Wall clock for `fetchedAt` / `updatedAt` (injectable for deterministic tests). */
  now: Date;
  /** Aborted on per-adapter timeout or run cancellation. Pass to every request. */
  signal: AbortSignal;
  log: (msg: string) => void;
  /** True when talking to real servers: enables per-host TLS fixes (pinned intermediates) in util/http.ts. */
  liveNetwork?: boolean;
  /** Reference layer keyed by race id (`senate:GA`), used for candidate matching. */
  metas: Map<string, RaceMeta>;
}

export interface Adapter {
  id: string;
  tier: Tier;
  states: string[];
  /** Suggested poll interval. Ingest may run slower, never faster. */
  cadenceSec: number;
  fetch(ctx: AdapterCtx): Promise<Race[]>;
}

export interface RunOptions {
  /** Per-adapter wall-clock budget. Default 45 s. */
  timeoutMs?: number;
  /** Adapters running at once. Default 4. */
  concurrency?: number;
}

export interface RunResult {
  races: Race[];
  feeds: FeedStatus[];
}

/** Context accepted by `runAdapters`: signal/log are optional and filled in per adapter. */
export type RunCtx = Omit<AdapterCtx, "signal" | "log"> & {
  signal?: AbortSignal;
  log?: (msg: string) => void;
};

class AdapterTimeout extends Error {
  constructor(id: string, ms: number) {
    super(`${id}: timed out after ${ms} ms`);
    this.name = "AdapterTimeout";
  }
}

/**
 * Run adapters with a concurrency cap, a per-adapter timeout and full error
 * isolation. Returns every valid race plus one FeedStatus per adapter.
 * A failing adapter yields `ok: false` + `lastError` and contributes no races.
 * Races failing schema validation are dropped individually and logged.
 */
export async function runAdapters(
  adapters: Adapter[],
  base: RunCtx,
  opts: RunOptions = {},
): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const log = base.log ?? (() => {});
  const races: Race[] = [];
  const feeds: FeedStatus[] = new Array<FeedStatus>(adapters.length);

  let next = 0;
  const worker = async () => {
    while (next < adapters.length) {
      const i = next++;
      const adapter = adapters[i];
      if (!adapter) break;
      feeds[i] = await runOne(adapter, base, timeoutMs, log, races);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, adapters.length) }, worker));
  return { races, feeds };
}

async function runOne(
  adapter: Adapter,
  base: RunCtx,
  timeoutMs: number,
  log: (msg: string) => void,
  sink: Race[],
): Promise<FeedStatus> {
  const started = Date.now();
  const ac = new AbortController();
  const onOuterAbort = () => ac.abort(base.signal?.reason);
  if (base.signal) {
    if (base.signal.aborted) onOuterAbort();
    else base.signal.addEventListener("abort", onOuterAbort, { once: true });
  }
  const timer = setTimeout(() => ac.abort(new AdapterTimeout(adapter.id, timeoutMs)), timeoutMs);

  const baseFetch = base.fetch;
  const ctx: AdapterCtx = {
    ...base,
    signal: ac.signal,
    log: (msg) => log(`[${adapter.id}] ${msg}`),
    // Always bind the per-adapter signal so a slow upstream cannot outlive the budget.
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      baseFetch(input, { ...init, signal: init?.signal ?? ac.signal })) as typeof fetch,
  };

  const status: FeedStatus = {
    adapter: adapter.id,
    tier: adapter.tier,
    states: adapter.states,
    ok: false,
    racesUpdated: 0,
  };

  try {
    const result = await Promise.race([
      adapter.fetch(ctx),
      new Promise<never>((_, reject) => {
        ac.signal.addEventListener(
          "abort",
          () => reject(ac.signal.reason ?? new AdapterTimeout(adapter.id, timeoutMs)),
          { once: true },
        );
      }),
    ]);
    let kept = 0;
    for (const r of result) {
      const parsed = Race.safeParse(r);
      if (parsed.success) {
        sink.push(parsed.data);
        kept++;
      } else {
        ctx.log(`dropped invalid race ${String((r as { id?: unknown })?.id)}: ${parsed.error.issues[0]?.message ?? "schema error"}`);
      }
    }
    status.ok = true;
    status.lastOkAt = base.now.toISOString();
    status.racesUpdated = kept;
  } catch (err) {
    status.ok = false;
    status.lastError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    ctx.log(`failed: ${status.lastError}`);
  } finally {
    clearTimeout(timer);
    base.signal?.removeEventListener("abort", onOuterAbort);
    status.latencyMs = Date.now() - started;
  }
  return status;
}
