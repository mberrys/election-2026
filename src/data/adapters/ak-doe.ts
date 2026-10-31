import type { CandidateResult, Race, ReportingUnit, VoteModes } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { getText } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, type FeedCandidate } from "./util/names";
import { resolveContest } from "./util/race-id";
import { assembleRace, addModes, makeUnit } from "./util/race";

/**
 * Alaska Division of Elections — precinct CSV.
 *
 * Verified 2026-10-30: https://www.elections.alaska.gov/enr26/results/GA_ENR_Precinct_State_of_Alaska.csv
 * (200, 4.7 MB, 28k rows; HTML pages 403 to curl, files OK). 2024 equivalent paths (enr24/…) 404.
 * Current file carries DoE test numbers with Reporting_flag=0 everywhere.
 *
 * Columns (header row, trailing comma): Precinct_name, Reporting_flag, Pct_Id ("01-600"; pseudo-precincts
 * "01" = "District 1 - Absentee", "99" = "HD99 Fed Overseas Absentee"), Pct_seq_nbr, Reg_voters,
 * Aggregation_ID, Contest_Id, Contest_seq_nbr, Contest_title ("U.S. Senator", "U.S. Representative",
 * "Governor / Lieutenant Governor", "House District 1", "Senate District A", "BM#1 ..."), Contest_party_name,
 * Selectable_Options, Candidate_State_ID, candidate_id, candidate_name ("Peltola, Mary"), Candidate_Type,
 * cand_seq_nbr, Party_Code (REP, DEM, LIB, GRN, UND, NON, RAP, "", "REP/NON"), total_ballots, total_votes,
 * total_under_votes, total_over_votes, then {Election Day, Absentee, Early Voting, Question, Remote} ×
 * {_ballots, _votes, _under_votes, _over_votes}.
 *
 * Alaska has no counties: units are House districts (locality level, id "AK-HD01"), derived from the
 * two-digit Pct_Id prefix (validated: every "House District N" contest row lives in prefix N).
 * General elections are ranked-choice: this file is FIRST CHOICES only; attribution says so.
 */
export interface AkConfig {
  id?: string;
  url?: string;
  cadenceSec?: number;
}

const ATTRIBUTION = "Alaska Division of Elections — RCV first choices";

/** RFC-4180-ish CSV parser (quotes, doubled quotes, embedded commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export function akDistrictOf(pctId: string): string {
  const m = pctId.match(/^(\d{2})/);
  return m ? (m[1] as string) : "00";
}

export function makeAkAdapter(config: AkConfig = {}): Adapter {
  const id = config.id ?? "ak-doe";
  const url = config.url ?? "https://www.elections.alaska.gov/enr26/results/GA_ENR_Precinct_State_of_Alaska.csv";

  return {
    id,
    tier: "A",
    states: ["AK"],
    cadenceSec: config.cadenceSec ?? 90,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const text = await getText(ctx, url);
      const rows = parseCsv(text);
      const header = rows[0];
      if (!header) throw new Error("empty CSV");
      const col = new Map(header.map((h, i) => [h.trim(), i]));
      const need = ["Pct_Id", "Reporting_flag", "Contest_title", "candidate_id", "candidate_name", "Party_Code", "total_votes"];
      for (const n of need) if (!col.has(n)) throw new Error(`missing column ${n}`);
      const c = (name: string) => col.get(name) as number;
      const get = (r: string[], name: string) => r[c(name)] ?? "";
      const n = (r: string[], name: string) => (col.has(name) ? Number(get(r, name)) || 0 : 0);

      interface Agg {
        title: string;
        cands: Map<string, { name: string; party: string; votes: number; modes: VoteModes }>;
        districts: Map<string, { votes: Map<string, number>; modes: VoteModes; precincts: Set<string>; reporting: Set<string> }>;
      }
      const contests = new Map<string, Agg>();
      for (const r of rows.slice(1)) {
        const title = get(r, "Contest_title");
        let agg = contests.get(title);
        if (!agg) {
          if (!resolveContest(title, "AK", id)) continue;
          agg = { title, cands: new Map(), districts: new Map() };
          contests.set(title, agg);
        }
        const candId = get(r, "candidate_id");
        const votes = n(r, "total_votes");
        const modes: VoteModes = {
          electionDay: n(r, "Election Day_votes"),
          mail: n(r, "Absentee_votes"),
          early: n(r, "Early Voting_votes"),
          provisional: n(r, "Question_votes"),
        };
        const cand = agg.cands.get(candId) ?? { name: get(r, "candidate_name"), party: get(r, "Party_Code"), votes: 0, modes: {} };
        cand.votes += votes;
        cand.modes = addModes(cand.modes, modes) ?? modes;
        agg.cands.set(candId, cand);

        const pctId = get(r, "Pct_Id");
        const dist = akDistrictOf(pctId);
        let d = agg.districts.get(dist);
        if (!d) {
          d = { votes: new Map(), modes: {}, precincts: new Set(), reporting: new Set() };
          agg.districts.set(dist, d);
        }
        d.votes.set(candId, (d.votes.get(candId) ?? 0) + votes);
        d.modes = addModes(d.modes, modes) ?? modes;
        if (/^\d{2}-/.test(pctId)) {
          // Real precincts only; "District N - Absentee" pseudo-precincts carry votes but are not counted.
          d.precincts.add(pctId);
          if (get(r, "Reporting_flag") === "1") d.reporting.add(pctId);
        }
      }

      const races: Race[] = [];
      for (const agg of contests.values()) {
        const resolved = resolveContest(agg.title, "AK", id);
        if (!resolved) continue;
        const ids = [...agg.cands.keys()];
        const feed: FeedCandidate[] = ids.map((k) => {
          const cand = agg.cands.get(k) as { name: string; party: string; votes: number };
          return { name: cand.name, party: normalizeParty(cand.party), votes: cand.votes };
        });
        const candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
        const idByFeed = new Map(ids.map((k, i) => [k, (candidates[i] as CandidateResult).id]));
        let modes: VoteModes | undefined;
        for (const k of ids) modes = addModes(modes, (agg.cands.get(k) as { modes: VoteModes }).modes);

        const units: ReportingUnit[] = [];
        let pr = 0;
        let pt = 0;
        for (const [dist, d] of [...agg.districts].sort(([a], [b]) => a.localeCompare(b))) {
          const votes: Record<string, number> = {};
          for (const [k, v] of d.votes) {
            const cid = idByFeed.get(k) as string;
            votes[cid] = (votes[cid] ?? 0) + v;
          }
          pr += d.reporting.size;
          pt += d.precincts.size;
          units.push(
            makeUnit(
              {
                id: `AK-HD${dist}`,
                name: dist === "99" ? "Federal Overseas Absentee" : `House District ${Number(dist)}`,
                level: "locality",
                precinctsReporting: d.reporting.size,
                precinctsTotal: d.precincts.size,
                modes: d.modes,
              },
              votes,
            ),
          );
        }
        races.push(
          assembleRace({
            ...resolved,
            candidates,
            units,
            precinctsReporting: pr,
            precinctsTotal: pt,
            modes,
            source: { adapter: id, tier: "A", url, attribution: ATTRIBUTION },
            ctx,
          }),
        );
      }
      ctx.log(`${races.length} races (RCV first choices) from ${rows.length - 1} rows`);
      return races;
    },
  };
}

export const akDoe = makeAkAdapter();
