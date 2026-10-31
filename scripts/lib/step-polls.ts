import type { z } from "zod";
import { PollAverage, type RaceMeta } from "../../src/data/schema";

type PollAverageT = z.infer<typeof PollAverage>;
import { fetchJson, fetchText } from "./http";
import { stateByName } from "./states";
import { csvObjects, info, lastName, round, warn } from "./util";

export const VOTEHUB_BASE = "https://api.votehub.com";
export const RIO_GENERIC_CSV = "https://www.riotimesonline.com/wp-content/uploads/rt-live/dataroom-us-generic-ballot.csv";
export const RIO_JSON = "https://www.riotimesonline.com/wp-content/uploads/rt-live/dataroom-us.json";

export interface VoteHubPoll {
  id: string;
  poll_type: string;
  sample_size: number | null;
  population: string | null;
  url: string;
  created_at: string;
  start_date: string;
  end_date: string;
  pollster: string;
  answers: Array<{ choice: string; pct: number }>;
  seat_name: string | null;
  sponsors: string[];
  internal: boolean;
  partisan: string | null;
  subject: string | null;
}

export interface PollsOut {
  builtAt: string;
  generic: {
    riotimes?: {
      d: number;
      r: number;
      margin: number;
      asOf: string;
      method: string;
      sources: Array<{ source: string; d: number; r: number; margin: number; updated: string; inAverage: boolean; url: string }>;
      license: string;
    };
    votehub?: PollAverageT & { windowDays: number; pollsters: number };
  };
  races: Record<string, PollAverageT>;
  /** Weekly rolling poll averages since TREND_START: "generic" plus race ids with enough polls. */
  trend: Record<string, TrendPoint[]>;
  votehub: {
    reachable: boolean;
    status: number;
    auth: string;
    endpoints: string[];
    filters: string[];
    pollTypes: string[];
    subjectsSeen: Record<string, number>;
    note: string;
  };
  riotimes: { reachable: boolean; status: number; updated?: string };
}


function avgWindow(polls: VoteHubPoll[], pick: (p: VoteHubPoll) => { d?: number; r?: number }, days: number, minN = 5) {
  const dated = polls
    .filter((p) => p.end_date && !p.internal)
    .sort((a, b) => (a.end_date < b.end_date ? 1 : -1));
  if (dated.length === 0) return undefined;
  const latest = dated[0].end_date;
  const cutoff = new Date(new Date(latest).getTime() - days * 86400000).toISOString().slice(0, 10);
  let win = dated.filter((p) => p.end_date >= cutoff);
  if (win.length < minN) win = dated.slice(0, minN);
  const vals = win.map(pick).filter((v) => typeof v.d === "number" && typeof v.r === "number") as Array<{ d: number; r: number }>;
  if (vals.length === 0) return undefined;
  const d = vals.reduce((a, v) => a + v.d, 0) / vals.length;
  const r = vals.reduce((a, v) => a + v.r, 0) / vals.length;
  return { d: round(d, 1), r: round(r, 1), n: vals.length, asOf: latest, pollsters: new Set(win.map((p) => p.pollster)).size };
}

export interface TrendPoint {
  /** Week-ending date, YYYY-MM-DD. */
  t: string;
  d: number;
  r: number;
  n: number;
}

export const TREND_START = "2026-01-01";
const DAY = 86400000;

/**
 * Weekly rolling averages of D and R (simple mean of polls ending within `windowDays` of each week-end), oldest
 * first. Internals are excluded and a point needs `minN` polls, so thin stretches leave gaps instead of noise.
 */
export function pollTrend(
  polls: VoteHubPoll[],
  pick: (p: VoteHubPoll) => { d?: number; r?: number },
  opts: { windowDays?: number; minN?: number; start?: string } = {},
): TrendPoint[] {
  const windowDays = opts.windowDays ?? 28;
  const minN = opts.minN ?? 3;
  const dated = polls
    .filter((p) => p.end_date && !p.internal)
    .map((p) => ({ end: p.end_date.slice(0, 10), v: pick(p) }))
    .filter((p): p is { end: string; v: { d: number; r: number } } => typeof p.v.d === "number" && typeof p.v.r === "number");
  if (!dated.length) return [];
  const last = dated.reduce((m, p) => (p.end > m ? p.end : m), "");
  const out: TrendPoint[] = [];
  const startMs = Date.parse(opts.start ?? TREND_START);
  for (let t = Date.parse(last); t >= startMs; t -= 7 * DAY) {
    const hi = new Date(t).toISOString().slice(0, 10);
    const lo = new Date(t - windowDays * DAY).toISOString().slice(0, 10);
    const win = dated.filter((p) => p.end <= hi && p.end > lo);
    if (win.length < minN) continue;
    out.push({
      t: hi,
      d: round(win.reduce((a, p) => a + p.v.d, 0) / win.length, 1),
      r: round(win.reduce((a, p) => a + p.v.r, 0) / win.length, 1),
      n: win.length,
    });
  }
  return out.reverse();
}

function genericPick(p: VoteHubPoll): { d?: number; r?: number } {
  let d: number | undefined;
  let r: number | undefined;
  for (const a of p.answers) {
    const c = a.choice.toLowerCase();
    if (/^dem/.test(c)) d = a.pct;
    else if (/^rep|^gop/.test(c)) r = a.pct;
  }
  return { d, r };
}

/** Map a VoteHub subject ("2026 Georgia", "2026 NY-23", "2026 Ohio") to a race id present in `races`. */
function subjectToRaceId(subject: string, pollType: string, byId: Map<string, RaceMeta>): string | undefined {
  const s = subject.replace(/^2026\s+/, "").trim();
  if (/ (Democratic|Republican)$/.test(s)) return undefined; // primary polls
  if (pollType === "us-representative") {
    const m = /^([A-Z]{2})-(\d{1,2}|AL)$/.exec(s);
    if (!m) return undefined;
    const d = m[2] === "AL" ? "AL" : m[2].padStart(2, "0");
    const id = `house:${m[1]}-${d}`;
    return byId.has(id) ? id : undefined;
  }
  const st = stateByName(s.replace(/\s*\(special\)\s*$/i, ""));
  if (!st) return undefined;
  if (pollType === "governor") {
    const id = `governor:${st.abbr}`;
    return byId.has(id) ? id : undefined;
  }
  if (pollType === "us-senator") {
    const special = /special/i.test(s);
    const reg = `senate:${st.abbr}`;
    const sp = `senate:${st.abbr}-special`;
    if (special) return byId.has(sp) ? sp : undefined;
    if (byId.has(reg)) return reg;
    if (byId.has(sp)) return sp; // OH/FL only have the special in 2026
    return undefined;
  }
  return undefined;
}

function racePick(race: RaceMeta): (p: VoteHubPoll) => { d?: number; r?: number } {
  const dNames = race.candidates.filter((c) => c.party === "D").map((c) => lastName(c.name));
  const rNames = race.candidates.filter((c) => c.party === "R").map((c) => lastName(c.name));
  return (p) => {
    let d: number | undefined;
    let r: number | undefined;
    for (const a of p.answers) {
      const ln = lastName(a.choice);
      const c = a.choice.toLowerCase();
      if (dNames.includes(ln) || /^dem/.test(c)) d = Math.max(d ?? 0, a.pct);
      else if (rNames.includes(ln) || /^rep|^gop/.test(c)) r = Math.max(r ?? 0, a.pct);
    }
    return { d, r };
  };
}

export async function buildPolls(races: RaceMeta[]): Promise<PollsOut> {
  const out: PollsOut = {
    builtAt: new Date().toISOString(),
    generic: {},
    races: {},
    trend: {},
    votehub: {
      reachable: false,
      status: 0,
      auth: "none required (verified from Node fetch, no key/header)",
      endpoints: ["/polls", "/polls/{id}", "/subjects", "/poll-types"],
      filters: ["poll_type", "subject", "pollster", "start_date", "end_date", "population"],
      pollTypes: [],
      subjectsSeen: {},
      note: "",
    },
    riotimes: { reachable: false, status: 0 },
  };

  // ---- Rio Times generic ballot ----
  try {
    const res = await fetchText(RIO_GENERIC_CSV, { label: "riotimes-generic" });
    out.riotimes.status = res.status;
    if (res.ok) {
      out.riotimes.reachable = true;
      const rows = csvObjects(res.body);
      const sources = rows.map((r) => ({
        source: r.source,
        d: Number(r.dem_pct),
        r: Number(r.rep_pct),
        margin: Number(r.margin_dem),
        updated: r.updated,
        inAverage: r.in_average === "true",
        url: r.url,
      }));
      const used = sources.filter((s) => s.inAverage && Number.isFinite(s.d) && Number.isFinite(s.r));
      if (used.length) {
        const d = used.reduce((a, s) => a + s.d, 0) / used.length;
        const r = used.reduce((a, s) => a + s.r, 0) / used.length;
        out.generic.riotimes = {
          d: round(d, 1),
          r: round(r, 1),
          margin: round(d - r, 1),
          asOf: used.map((s) => s.updated).sort().reverse()[0],
          method: "equal-weight mean of public averages (DDHQ, FiftyPlusOne, NBC, RCP, Silver Bulletin); stale >21d dropped",
          sources,
          license: "CC BY 4.0 — credit The Rio Times and link to https://www.riotimesonline.com/us-midterms-2026-data-room/",
        };
      }
      const j = await fetchJson<{ updated?: string }>(RIO_JSON, { label: "riotimes-json" });
      out.riotimes.updated = j.data?.updated;
    } else warn(`Rio Times generic-ballot CSV HTTP ${res.status}`);
  } catch (e) {
    warn(`Rio Times generic ballot failed: ${(e as Error).message}`);
  }

  // ---- VoteHub ----
  const byId = new Map(races.map((r) => [r.id, r]));
  try {
    const types = await fetchJson<string[]>(`${VOTEHUB_BASE}/poll-types`, { label: "votehub-types" });
    if (types.data) out.votehub.pollTypes = types.data;
    const gen = await fetchJson<VoteHubPoll[]>(`${VOTEHUB_BASE}/polls?poll_type=generic-ballot`, { label: "votehub-generic" });
    out.votehub.status = gen.res.status;
    out.votehub.reachable = gen.res.ok;
    if (gen.data) {
      const a = avgWindow(gen.data, genericPick, 14, 8);
      if (a) {
        out.generic.votehub = PollAverage.parse({ d: a.d, r: a.r, n: a.n, asOf: a.asOf, source: "VoteHub (CC BY 4.0)" }) as PollAverageT & {
          windowDays: number;
          pollsters: number;
        };
        out.generic.votehub.windowDays = 14;
        out.generic.votehub.pollsters = a.pollsters;
      }
      const gt = pollTrend(gen.data, genericPick, { minN: 5 });
      if (gt.length) out.trend.generic = gt;
      info(`VoteHub generic ballot: ${gen.data.length} polls, ${gt.length} trend points`);
    }
    for (const pt of ["us-senator", "governor", "us-representative"]) {
      const r = await fetchJson<VoteHubPoll[]>(`${VOTEHUB_BASE}/polls?poll_type=${pt}`, { label: `votehub-${pt}` });
      if (!r.data) {
        warn(`VoteHub ${pt} HTTP ${r.res.status}`);
        continue;
      }
      const groups = new Map<string, VoteHubPoll[]>();
      for (const p of r.data) {
        if (!p.subject) continue;
        out.votehub.subjectsSeen[p.subject] = (out.votehub.subjectsSeen[p.subject] ?? 0) + 1;
        const id = subjectToRaceId(p.subject, pt, byId);
        if (!id) continue;
        const g = groups.get(id) ?? [];
        g.push(p);
        groups.set(id, g);
      }
      for (const [id, polls] of groups) {
        const race = byId.get(id)!;
        const a = avgWindow(polls, racePick(race), 30, 3);
        if (!a) continue;
        const pa: PollAverageT = PollAverage.parse({ d: a.d, r: a.r, n: a.n, asOf: a.asOf, source: "VoteHub (CC BY 4.0)" });
        out.races[id] = pa;
        race.polls = pa;
        const tr = pollTrend(polls, racePick(race));
        if (tr.length >= 2) out.trend[id] = tr;
      }
      info(`VoteHub ${pt}: ${r.data.length} polls → ${groups.size} races`);
    }
    out.votehub.note =
      "Beta API. /polls accepts poll_type (approval, favorability, generic-ballot, governor, us-senator, us-representative, ...) and subject ('2026 Georgia', '2026 NY-23'); " +
      "race averages here are simple means over the last 30 days (min 3 polls), excluding internals. Primary-subject polls ('2026 Texas Republican') ignored. " +
      "Observed: start_date/end_date/limit/page/offset/sort parameters are ignored (same 547-row generic list returned); no auth or rate-limit headers seen.";
  } catch (e) {
    warn(`VoteHub failed: ${(e as Error).message}`);
  }
  return out;
}
