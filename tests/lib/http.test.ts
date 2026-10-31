import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCron, safeEqual } from "../../src/lib/http";

const req = (headers: Record<string, string> = {}, query = "") =>
  new Request(`https://example.test/api/ingest${query}`, { headers });

afterEach(() => vi.unstubAllEnvs());

describe("isAuthorizedCron", () => {
  it("accepts the Bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isAuthorizedCron(req({ authorization: "Bearer s3cret" }))).toBe(true);
  });

  it("rejects a wrong or missing header", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isAuthorizedCron(req({ authorization: "Bearer nope" }))).toBe(false);
    expect(isAuthorizedCron(req())).toBe(false);
  });

  it("no longer accepts the secret in the query string", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isAuthorizedCron(req({}, "?key=s3cret"))).toBe(false);
  });

  it("fails closed in production when the secret is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAuthorizedCron(req())).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares strings of differing length without throwing", () => {
    expect(safeEqual("a", "abc")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
  });
});
