import { createWriteStream } from "node:fs";
import { mkdir, stat, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UA = "BigBoard-geometry-build/1.0 (+https://github.com/mbx30/election-2026)";

/**
 * Download `url` to `dest` unless a non-empty file already exists there.
 * Returns true when a network fetch happened.
 */
export async function download(url: string, dest: string): Promise<boolean> {
  try {
    const s = await stat(dest);
    if (s.size > 0) return false;
  } catch {
    // not cached
  }
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  const s = await stat(tmp);
  if (s.size === 0) {
    await unlink(tmp);
    throw new Error(`GET ${url} -> empty body`);
  }
  await rename(tmp, dest);
  return true;
}

/** Run up to `limit` download tasks at a time. */
export async function downloadAll(
  jobs: { url: string; dest: string }[],
  limit = 6,
  onDone?: (job: { url: string; dest: string }, fetched: boolean) => void,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      const fetched = await download(job.url, job.dest);
      onDone?.(job, fetched);
    }
  });
  await Promise.all(workers);
}
