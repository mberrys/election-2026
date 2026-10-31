import type { CandidateResult, Race, ReportingUnit } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { getJson } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, type FeedCandidate } from "./util/names";
import { displayName, resolveContest } from "./util/race-id";
import { assembleRace, makeUnit } from "./util/race";

/**
 * ============================  NOT A PRODUCT SOURCE  ============================
 * Private cross-check against the NYT election JSON. OFF unless
 * `ENABLE_NYT_XCHECK=1`. Races come back tagged tier "C",
 * `source.adapter = "nyt-xcheck"`, and the ingest/merge layer MUST drop them
 * before writing a snapshot — the UI must never render or be influenced by them.
 *
 * Why: the NYT terms of service (robots.txt + ToS, checked 2026-10-30) prohibit
 * automated data mining / scraping without written permission, prohibit
 * providing archived or cached datasets to others, and prohibit commercial use.
 * The data is AP-sourced; redistributing it (including AP race calls) is the
 * sharpest legal exposure. CORS being open is not a license. This adapter exists
 * only so an operator can compare our state-feed totals to a second source during
 * the night at a low polling rate (≥ 2 min). No fixture of the live file is kept
 * in the repo; tests use a tiny synthetic document with the same shape.
 *
 * Endpoint (only one is ever fetched):
 *   https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-senate.json
 * Shape (observed 2026-10-30, 35 races):
 *   { races: [{ nyt_id: "GA-G-S-2026-11-03", office: "U.S. Senate", office_id: "S", race_type_id: "G"|"S_W",
 *               race_call_status, candidate_metadata: { [nyt_id]: { first_name, last_name, incumbent,
 *               party: { nyt_id: "DEM"|"REP"|..., name, abbreviation } } },
 *               top_reporting_unit: { eevp, total_expected_vote, total_votes, precincts_reporting, precincts_total,
 *                                     candidates: [{ nyt_id, votes: { total, advance, absentee_mail, ... } }] },
 *               reporting_units: [{ level: "state"|"county", fips_state, fips_county, name, eevp,
 *                                   total_expected_vote, precincts_reporting, precincts_total, candidates }] }] }
 * We deliberately do NOT copy `race_call_status`, `outcome.won` or `called_by`.
 */
export interface NytSenateFile {
  races: NytRace[];
}
export interface NytRace {
  nyt_id: string;
  office_id: string;
  race_type_id: string;
  candidate_metadata: Record<
    string,
    { first_name: string | null; last_name: string | null; incumbent: boolean; party: { nyt_id: string } | null }
  >;
  top_reporting_unit: NytUnit;
  reporting_units: NytUnit[];
}
export interface NytUnit {
  nyt_id: string;
  name: string;
  level: string;
  fips_state: string | null;
  fips_county: string | null;
  state_postal: string;
  eevp: number | null;
  total_votes: number;
  total_expected_vote: number | null;
  precincts_reporting: number | null;
  precincts_total: number | null;
  candidates: { nyt_id: string; votes: { total: number } }[];
}

export const NYT_SENATE_URL = "https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-senate.json";

export function isNytXcheckEnabled(): boolean {
  return process.env.ENABLE_NYT_XCHECK === "1";
}

export function parseNytSenate(file: NytSenateFile, ctx: AdapterCtx, url: string): Race[] {
  const races: Race[] = [];
  for (const r of file.races) {
    if (r.office_id !== "S") continue;
    const state = r.nyt_id.slice(0, 2).toUpperCase();
    const special = r.race_type_id !== "G" || /-S_W-/.test(r.nyt_id);
    const resolved = resolveContest(special ? "U.S. Senate (Special)" : "U.S. Senate", state, "nyt-xcheck");
    if (!resolved) continue;
    const top = r.top_reporting_unit;
    const feed: FeedCandidate[] = top.candidates.map((c) => {
      const m = r.candidate_metadata[c.nyt_id];
      const name = m ? [m.first_name, m.last_name].filter(Boolean).join(" ") || c.nyt_id : c.nyt_id;
      return { name, party: normalizeParty(m?.party?.nyt_id), votes: c.votes.total, incumbent: m?.incumbent };
    });
    const candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
    const idByNyt = new Map(top.candidates.map((c, i) => [c.nyt_id, (candidates[i] as CandidateResult).id]));
    const units: ReportingUnit[] = r.reporting_units
      .filter((u) => u.level === "county" && u.fips_state && u.fips_county)
      .map((u) => {
        const fips = `${u.fips_state}${u.fips_county}`;
        const votes: Record<string, number> = {};
        for (const c of u.candidates) {
          const cid = idByNyt.get(c.nyt_id) ?? c.nyt_id;
          votes[cid] = (votes[cid] ?? 0) + c.votes.total;
        }
        const unit = makeUnit(
          {
            id: fips,
            name: u.name,
            fips,
            level: "county",
            ...(u.precincts_reporting != null ? { precinctsReporting: u.precincts_reporting } : {}),
            ...(u.precincts_total != null ? { precinctsTotal: u.precincts_total } : {}),
            ...(u.total_expected_vote != null ? { expectedVote: u.total_expected_vote } : {}),
            ...(u.eevp != null ? { pctExpected: u.eevp } : {}),
          },
          votes,
        );
        return unit;
      });
    const race = assembleRace({
      ...resolved,
      name: displayName("senate", state, undefined, special),
      candidates,
      units,
      precinctsReporting: top.precincts_reporting ?? undefined,
      precinctsTotal: top.precincts_total ?? undefined,
      source: { adapter: "nyt-xcheck", tier: "C", url, attribution: "NYT/AP — private cross-check only, never render" },
      ctx,
    });
    if (top.total_expected_vote != null) race.expectedVote = top.total_expected_vote;
    if (top.eevp != null) race.pctExpected = top.eevp;
    races.push(race);
  }
  return races;
}

export const nytXcheck: Adapter = {
  id: "nyt-xcheck",
  tier: "C",
  states: [],
  cadenceSec: 120,
  async fetch(ctx: AdapterCtx): Promise<Race[]> {
    if (!isNytXcheckEnabled()) {
      ctx.log("disabled (ENABLE_NYT_XCHECK != 1)");
      return [];
    }
    const file = await getJson<NytSenateFile>(ctx, NYT_SENATE_URL);
    const races = parseNytSenate(file, ctx, NYT_SENATE_URL);
    ctx.log(`${races.length} senate races for private cross-check (tier C, never rendered)`);
    return races;
  },
};
