import type { Race, ReportingUnit, VoteModes } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { getJson, mapPool, num } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, type FeedCandidate } from "./util/names";
import { resolveContest } from "./util/race-id";
import { assembleRace, addModes, makeUnit } from "./util/race";
import { countyName } from "./util/fips";

/**
 * North Carolina State Board of Elections — Election Night Reporting.
 *
 * Verified 2026-10-30:
 *   statewide  https://er.ncsbe.gov/enr/20261103/data/results_0.txt   (200, 660 rows, staged at 0 votes)
 *   county     https://er.ncsbe.gov/enr/20261103/data/results_{cid}.txt cid = 1..100 (alphabetical county id;
 *              results_101.txt → 404). cid 1 = Alamance, 92 = Wake. FIPS = 37 + (2*cid − 1).
 *   2024       https://er.ncsbe.gov/enr/20241105/data/results_0.txt and results_{cid}.txt still served (fixture).
 * Format: JSON array served as text/plain. One row per (contest, ballot item):
 *   cid  county id ("0" = statewide)         cnm  contest name "US SENATE (VOTE FOR 1)"
 *   gid/lid contest group/list ids           bnm  ballot name (candidate)
 *   pty  party code DEM/REP/LIB/GRE/UNA/...  vct  vote count        pct  share (0–1 string)
 *   prt/ptl precincts reporting/total        evc  election-day votes
 *   ovc  one-stop (early in-person) votes    avc  absentee-by-mail votes      pvc  provisional votes
 *   (2024 check: vct == evc+ovc+avc+pvc; ovc is the large early-vote bucket)
 */
export interface NcRow {
  cid: string;
  cnm: string;
  gid: string;
  lid: string;
  bnm: string;
  dtx: string;
  pty: string;
  vct: string;
  pct: string;
  prt: string;
  ptl: string;
  evc: string;
  ovc: string;
  avc: string;
  pvc: string;
  col: string;
  ogl: string;
  ref: string;
}

export interface NcConfig {
  id?: string;
  /** Election folder, e.g. "20261103". */
  electionDate?: string;
  /** Pull the 100 per-county files for county units. Default true. */
  counties?: boolean;
  concurrency?: number;
  cadenceSec?: number;
}

const BASE = "https://er.ncsbe.gov/enr";
const ATTRIBUTION = "North Carolina State Board of Elections";

export function rowModes(r: NcRow): VoteModes {
  return { early: num(r.ovc), electionDay: num(r.evc), mail: num(r.avc), provisional: num(r.pvc) };
}

interface Contest {
  key: string;
  name: string;
  rows: NcRow[];
}

function groupContests(rows: NcRow[]): Contest[] {
  const m = new Map<string, Contest>();
  for (const r of rows) {
    const key = `${r.gid}|${r.cnm}`;
    let c = m.get(key);
    if (!c) {
      c = { key, name: r.cnm, rows: [] };
      m.set(key, c);
    }
    c.rows.push(r);
  }
  return [...m.values()];
}

export function makeNcAdapter(config: NcConfig = {}): Adapter {
  const id = config.id ?? "nc-ncsbe";
  const date = config.electionDate ?? "20261103";
  const withCounties = config.counties ?? true;
  const concurrency = config.concurrency ?? 8;
  const statewideUrl = `${BASE}/${date}/data/results_0.txt`;

  return {
    id,
    tier: "A",
    states: ["NC"],
    cadenceSec: config.cadenceSec ?? 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const rows = await getJson<NcRow[]>(ctx, statewideUrl);
      const contests = groupContests(rows);

      // Resolve tracked contests and the candidate ids we will use for county joins.
      const tracked = new Map<
        string,
        { contest: Contest; resolved: NonNullable<ReturnType<typeof resolveContest>>; candIdByBnm: Map<string, string> }
      >();
      for (const contest of contests) {
        const resolved = resolveContest(contest.name, "NC", id);
        if (!resolved) continue;
        const feed: FeedCandidate[] = contest.rows.map((r) => ({
          name: r.bnm,
          party: normalizeParty(r.pty),
          votes: num(r.vct),
        }));
        const cands = matchCandidates(feed, ctx.metas.get(resolved.id));
        const candIdByBnm = new Map<string, string>();
        contest.rows.forEach((r, i) => candIdByBnm.set(r.bnm, (cands[i] as { id: string }).id));
        tracked.set(contest.key, { contest, resolved, candIdByBnm });
      }

      // County files → units keyed by contest key.
      const unitsByContest = new Map<string, ReportingUnit[]>();
      if (withCounties) {
        const cids = Array.from({ length: 100 }, (_, i) => i + 1);
        const countyRows = await mapPool(cids, concurrency, async (cid) => {
          try {
            return await getJson<NcRow[]>(ctx, `${BASE}/${date}/data/results_${cid}.txt`);
          } catch (err) {
            if (ctx.signal.aborted) throw err;
            ctx.log(`county ${cid} unavailable: ${err instanceof Error ? err.message : String(err)}`);
            return [] as NcRow[];
          }
        });
        countyRows.forEach((crows, idx) => {
          const cid = idx + 1;
          const fips = `37${String(2 * cid - 1).padStart(3, "0")}`;
          const name = countyName("NC", fips) ?? `County ${cid}`;
          for (const c of groupContests(crows)) {
            const t = tracked.get(c.key);
            if (!t) continue;
            const votes: Record<string, number> = {};
            let modes: VoteModes | undefined;
            for (const r of c.rows) {
              const candId = t.candIdByBnm.get(r.bnm);
              if (!candId) continue;
              votes[candId] = (votes[candId] ?? 0) + num(r.vct);
              modes = addModes(modes, rowModes(r));
            }
            const first = c.rows[0];
            const unit = makeUnit(
              {
                id: fips,
                name,
                fips,
                level: "county",
                precinctsReporting: first ? num(first.prt) : undefined,
                precinctsTotal: first ? num(first.ptl) : undefined,
                ...(modes ? { modes } : {}),
              },
              votes,
            );
            const list = unitsByContest.get(c.key) ?? [];
            list.push(unit);
            unitsByContest.set(c.key, list);
          }
        });
      }

      const races: Race[] = [];
      for (const { contest, resolved } of tracked.values()) {
        const feed: FeedCandidate[] = contest.rows.map((r) => ({
          name: r.bnm,
          party: normalizeParty(r.pty),
          votes: num(r.vct),
        }));
        const candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
        let modes: VoteModes | undefined;
        for (const r of contest.rows) modes = addModes(modes, rowModes(r));
        const first = contest.rows[0];
        races.push(
          assembleRace({
            ...resolved,
            candidates,
            units: unitsByContest.get(contest.key) ?? [],
            precinctsReporting: first ? num(first.prt) : undefined,
            precinctsTotal: first ? num(first.ptl) : undefined,
            modes,
            source: { adapter: id, tier: "A", url: statewideUrl, attribution: ATTRIBUTION },
            ctx,
          }),
        );
      }
      ctx.log(`${races.length} races from ${contests.length} contests`);
      return races;
    },
  };
}

export const ncNcsbe = makeNcAdapter();
