import { readSlow, writeSlow } from "@/lib/snapshot-store";

const RIO_GENERIC_CSV = "https://www.riotimesonline.com/wp-content/uploads/rt-live/dataroom-us-generic-ballot.csv";

export type GenericBallotLive = {
  d: number;
  r: number;
  margin: number;
  asOf?: string;
  source: string;
  fetchedAt: string;
};

/** Split one CSV line, honoring double-quoted fields ("January 9, 2025 – …"). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvObjects(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const head = splitCsvLine(lines.shift() ?? "");
  return lines.map((l) => {
    const cells = splitCsvLine(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}


/** Fetch the Rio Times five-average generic ballot and store it in Redis. Throws on failure. */
export async function refreshGenericBallot(): Promise<GenericBallotLive> {
  const res = await fetch(RIO_GENERIC_CSV, { headers: { "User-Agent": "BigBoard2026/0.1" } });
  if (!res.ok) throw new Error(`Rio Times ${res.status}`);
  const rows = csvObjects(await res.text());
  const used = rows
    .filter((r) => r.in_average === "true")
    .map((r) => ({ d: Number(r.dem_pct), r: Number(r.rep_pct), updated: r.updated }))
    .filter((r) => Number.isFinite(r.d) && Number.isFinite(r.r));
  if (!used.length) throw new Error("no averages in CSV");
  const d = used.reduce((a, s) => a + s.d, 0) / used.length;
  const r = used.reduce((a, s) => a + s.r, 0) / used.length;
  const out: GenericBallotLive = {
    d: Math.round(d * 10) / 10,
    r: Math.round(r * 10) / 10,
    margin: Math.round((d - r) * 10) / 10,
    asOf: used.map((s) => s.updated).sort().reverse()[0],
    source: "Rio Times 5-average",
    fetchedAt: new Date().toISOString(),
  };
  await writeSlow("generic", out);
  return out;
}

/** Refresh only if the stored copy is older than maxAgeMs (default 30 min). Never throws. */
export async function refreshSlowIfStale(maxAgeMs = 30 * 60_000): Promise<void> {
  try {
    const cur = await readSlow<GenericBallotLive>("generic");
    if (cur && Date.now() - Date.parse(cur.fetchedAt) < maxAgeMs) return;
    await refreshGenericBallot();
  } catch (e) {
    console.error("[slow] generic ballot refresh failed", e);
  }
}
