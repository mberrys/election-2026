import tls from "node:tls";
import { Agent, fetch as undiciFetch } from "undici";
import type { AdapterCtx } from "../types";
import { GLOBALSIGN_GCC_R46_OV_TLS_CA_2025 } from "../certs";

/**
 * Browser-like request headers. Several state ENR hosts (Clarity, AK, MN
 * landing pages) 403 bare `curl` / default Node UAs; the result files
 * themselves are public. Accept-Encoding is set explicitly so Clarity serves
 * gzip (their origin returns 403/empty bodies to clients that do not accept it).
 */
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 BigBoard/0.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`HTTP ${status} ${url}`);
    this.name = "HttpError";
  }
}

/**
 * Network-level failures (socket reset, DNS blip, "fetch failed") are retried with backoff;
 * HTTP errors are not. Seen in practice: AK failed once at ~200 ms while CA/NC were mid-burst.
 */
/** Hosts with broken TLS chains get a dedicated undici Agent trusting Node's roots plus the missing intermediate. */
const EXTRA_CA_HOSTS: Record<string, string[]> = {
  "www.elections.alaska.gov": [GLOBALSIGN_GCC_R46_OV_TLS_CA_2025],
  "elections.alaska.gov": [GLOBALSIGN_GCC_R46_OV_TLS_CA_2025],
};
const agents = new Map<string, Agent>();

function fetchFor(ctx: AdapterCtx, url: string): typeof fetch {
  const host = new URL(url).hostname;
  const extra = EXTRA_CA_HOSTS[host];
  // Tests inject a stub fetch and leave liveNetwork unset.
  if (!extra || !ctx.liveNetwork) return ctx.fetch;
  let agent = agents.get(host);
  if (!agent) {
    agent = new Agent({ connect: { ca: [...tls.rootCertificates, ...extra] } });
    agents.set(host, agent);
  }
  const dispatcher = agent;
  return ((input: string, init?: RequestInit) =>
    undiciFetch(input, { ...(init as object), dispatcher } as Parameters<typeof undiciFetch>[1])) as unknown as typeof fetch;
}

async function request(ctx: AdapterCtx, url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  const doFetch = fetchFor(ctx, url);
  for (let i = 0; i < attempts; i++) {
    if (ctx.signal.aborted) break;
    try {
      const res = await doFetch(url, { headers: BROWSER_HEADERS, signal: ctx.signal, redirect: "follow" });
      if (!res.ok) throw new HttpError(url, res.status);
      return res;
    } catch (e) {
      if (e instanceof HttpError || ctx.signal.aborted) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  const cause = (lastErr as { cause?: { code?: string; message?: string } })?.cause;
  throw new Error(`network error after ${attempts} tries: ${cause?.code ?? cause?.message ?? String(lastErr)} ${url}`);
}

export async function getText(ctx: AdapterCtx, url: string): Promise<string> {
  const res = await request(ctx, url);
  // Strip a UTF-8 BOM (MN county files carry one).
  return (await res.text()).replace(/^﻿/, "");
}

export async function getJson<T>(ctx: AdapterCtx, url: string): Promise<T> {
  const text = await getText(ctx, url);
  return JSON.parse(text) as T;
}

export async function getBytes(ctx: AdapterCtx, url: string): Promise<Uint8Array> {
  const res = await request(ctx, url);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Like `getJson` but resolves `null` on any HTTP error (used for endpoints
 * that are known to be flaky, e.g. CA `/returns/us-rep` returning 500).
 */
export async function tryJson<T>(ctx: AdapterCtx, url: string): Promise<T | null> {
  try {
    return await getJson<T>(ctx, url);
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    ctx.log(`optional request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Bounded-concurrency map preserving order. Rejections propagate. */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return out;
}

/** "1,125" → 1125; "" / null → 0. */
export function num(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
