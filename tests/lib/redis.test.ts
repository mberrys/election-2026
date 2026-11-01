import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NAMES = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;

describe("getRedis", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const n of NAMES) vi.stubEnv(n, "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const load = async () => (await import("../../src/lib/redis")).getRedis();

  it("is null when nothing is configured", async () => {
    expect(await load()).toBeNull();
  });

  it("falls back to the legacy KV names when the Upstash names are blank, as copied from .env.example", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example.test");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    expect(await load()).not.toBeNull();
  });

  it("prefers the Upstash names when both are set", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://up.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    expect(await load()).not.toBeNull();
  });
});
