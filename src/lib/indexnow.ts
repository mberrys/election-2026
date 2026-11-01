import { SITE_URL } from "./site";

/**
 * IndexNow tells Bing-family search engines a URL changed, so they re-crawl it without waiting. The key is public by
 * design: it proves site ownership through the matching file in `public/`, which must hold exactly this string.
 */
export const INDEXNOW_KEY = "66db283fa5ba3360b6662f352f847d0d";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Per the IndexNow spec, one request carries at most 10,000 URLs. */
const MAX_URLS = 10_000;

export function indexNowPayload(urls: string[], base: string = SITE_URL) {
  return {
    host: new URL(base).host,
    key: INDEXNOW_KEY,
    keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, MAX_URLS),
  };
}

export interface IndexNowResult {
  submitted: number;
  status: number;
  ok: boolean;
}

/** POST the URL list. IndexNow answers 200 or 202 when it accepts the batch. */
export async function submitIndexNow(
  urls: string[],
  { base = SITE_URL, fetchImpl = fetch }: { base?: string; fetchImpl?: typeof fetch } = {},
): Promise<IndexNowResult> {
  const payload = indexNowPayload(urls, base);
  const res = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  return { submitted: payload.urlList.length, status: res.status, ok: res.status === 200 || res.status === 202 };
}
