import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowPayload, submitIndexNow } from "../../src/lib/indexnow";

describe("IndexNow", () => {
  it("serves the key from a file that holds exactly the key", () => {
    const file = readFileSync(join(__dirname, "../../public", `${INDEXNOW_KEY}.txt`), "utf8");
    expect(file.trim()).toBe(INDEXNOW_KEY);
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
  });

  it("builds the payload from the site host", () => {
    expect(indexNowPayload(["https://x.test/a"], "https://x.test")).toEqual({
      host: "x.test",
      key: INDEXNOW_KEY,
      keyLocation: `https://x.test/${INDEXNOW_KEY}.txt`,
      urlList: ["https://x.test/a"],
    });
  });

  it("caps one request at 10,000 URLs", () => {
    const urls = Array.from({ length: 10_050 }, (_, i) => `https://x.test/${i}`);
    expect(indexNowPayload(urls, "https://x.test").urlList).toHaveLength(10_000);
  });

  it("posts JSON and reports acceptance on 200 and 202 only", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 202 })).mockResolvedValueOnce(new Response(null, { status: 422 }));
    const ok = await submitIndexNow(["https://x.test/a"], { base: "https://x.test", fetchImpl });
    expect(ok).toEqual({ submitted: 1, status: 202, ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).host).toBe("x.test");
    expect((await submitIndexNow(["https://x.test/a"], { base: "https://x.test", fetchImpl })).ok).toBe(false);
  });
});
