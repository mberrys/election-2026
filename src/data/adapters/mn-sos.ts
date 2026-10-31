import type { CandidateResult, Race, ReportingUnit } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { getText } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, type FeedCandidate } from "./util/names";
import { resolveContest } from "./util/race-id";
import { assembleRace, makeUnit } from "./util/race";
import { countyName } from "./util/fips";

/**
 * Minnesota Secretary of State election-night flat files.
 *
 * Verified 2026-10-30: https://electionresultsfiles.sos.mn.gov/20261103/allracesbyprecinct.txt (200, 27 MB,
 * staged at 0). Also served: allracesbycounty.txt, ussenate.txt, ushouse.txt, Governor.txt, cntytbl.txt,
 * PrctTbl.txt. 2024 (20241105) equivalents still served. The sos.mn.gov landing page is behind Radware
 * (302 to a JS challenge) but the files host is open.
 *
 * Column spec ("Election Results File Format", MN SoS; semicolon-delimited, no header):
 *    1 State                               9 Suffix
 *    2 County ID (1–87, alphabetical)     10 Incumbent Code
 *    3 Precinct number (precinct files)   11 Party Abbreviation (DFL, R, LIB, GP/G, IND, WI=write-in, ...)
 *    4 Office ID (0102 US Sen, 0104–0111 US Rep 1–8, 0331 Governor)
 *    5 Office Name                        12 Number of precincts reporting (1/0 per precinct row)
 *    6 District                           13 Total precincts voting for the office (1 per precinct row)
 *    7 Candidate Order Code               14 Votes for candidate
 *    8 Candidate Name                     15 Percentage of votes for candidate
 *                                         16 Total votes for office in area
 * County FIPS = 27 + (2*countyId − 1) (MN counties are numbered alphabetically, same as FIPS).
 */
export interface MnRow {
  state: string;
  countyId: string;
  precinct: string;
  officeId: string;
  officeName: string;
  district: string;
  candOrder: string;
  candName: string;
  suffix: string;
  incumbent: string;
  party: string;
  precinctsReporting: number;
  precinctsTotal: number;
  votes: number;
  pct: number;
  officeTotal: number;
}

export function parseMnLine(line: string): MnRow | null {
  const f = line.split(";");
  if (f.length < 16 || f[0] !== "MN") return null;
  return {
    state: f[0] as string,
    countyId: f[1] as string,
    precinct: f[2] as string,
    officeId: f[3] as string,
    officeName: f[4] as string,
    district: f[5] as string,
    candOrder: f[6] as string,
    candName: f[7] as string,
    suffix: f[8] as string,
    incumbent: f[9] as string,
    party: f[10] as string,
    precinctsReporting: Number(f[11]) || 0,
    precinctsTotal: Number(f[12]) || 0,
    votes: Number(f[13]) || 0,
    pct: Number(f[14]) || 0,
    officeTotal: Number(f[15]) || 0,
  };
}

export interface MnConfig {
  id?: string;
  electionDate?: string;
  cadenceSec?: number;
}

const ATTRIBUTION = "Minnesota Secretary of State";

export function mnCountyFips(countyId: string): string {
  const n = Number(countyId);
  return `27${String(2 * n - 1).padStart(3, "0")}`;
}

export function makeMnAdapter(config: MnConfig = {}): Adapter {
  const id = config.id ?? "mn-sos";
  const date = config.electionDate ?? "20261103";
  const url = `https://electionresultsfiles.sos.mn.gov/${date}/allracesbyprecinct.txt`;

  return {
    id,
    tier: "A",
    states: ["MN"],
    cadenceSec: config.cadenceSec ?? 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const text = await getText(ctx, url);
      const races: Race[] = [];

      // office → { name, candidates by order code, per-county aggregates, precinct sets }
      interface Agg {
        name: string;
        cands: Map<string, { name: string; party: string; votes: number }>;
        counties: Map<string, { votes: Map<string, number>; reporting: Set<string>; precincts: Set<string> }>;
      }
      const offices = new Map<string, Agg>();
      for (const line of text.split(/\r?\n/)) {
        const r = parseMnLine(line);
        if (!r) continue;
        let agg = offices.get(r.officeId);
        if (!agg) {
          // Cheap pre-filter: only tracked offices get aggregated.
          if (!resolveContest(r.officeName, "MN", id)) continue;
          agg = { name: r.officeName, cands: new Map(), counties: new Map() };
          offices.set(r.officeId, agg);
        }
        const cand = agg.cands.get(r.candOrder) ?? { name: r.candName, party: r.party, votes: 0 };
        cand.votes += r.votes;
        agg.cands.set(r.candOrder, cand);
        let cty = agg.counties.get(r.countyId);
        if (!cty) {
          cty = { votes: new Map(), reporting: new Set(), precincts: new Set() };
          agg.counties.set(r.countyId, cty);
        }
        cty.votes.set(r.candOrder, (cty.votes.get(r.candOrder) ?? 0) + r.votes);
        cty.precincts.add(r.precinct);
        if (r.precinctsReporting > 0) cty.reporting.add(r.precinct);
      }

      for (const [, agg] of offices) {
        const resolved = resolveContest(agg.name, "MN", id);
        if (!resolved) continue;
        const orders = [...agg.cands.keys()];
        const feed: FeedCandidate[] = orders.map((o) => {
          const c = agg.cands.get(o) as { name: string; party: string; votes: number };
          return { name: c.name, party: normalizeParty(c.party), votes: c.votes };
        });
        const candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
        const idByOrder = new Map(orders.map((o, i) => [o, (candidates[i] as CandidateResult).id]));

        const units: ReportingUnit[] = [];
        let pr = 0;
        let pt = 0;
        for (const [countyId, c] of [...agg.counties].sort(([a], [b]) => Number(a) - Number(b))) {
          const fips = mnCountyFips(countyId);
          const votes: Record<string, number> = {};
          for (const [order, v] of c.votes) {
            const cid = idByOrder.get(order) as string;
            votes[cid] = (votes[cid] ?? 0) + v;
          }
          pr += c.reporting.size;
          pt += c.precincts.size;
          units.push(
            makeUnit(
              {
                id: fips,
                name: countyName("MN", fips) ?? `County ${countyId}`,
                fips,
                level: "county",
                precinctsReporting: c.reporting.size,
                precinctsTotal: c.precincts.size,
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
            source: { adapter: id, tier: "A", url, attribution: ATTRIBUTION },
            ctx,
          }),
        );
      }
      ctx.log(`${races.length} races from ${offices.size} tracked offices`);
      return races;
    },
  };
}

export const mnSos = makeMnAdapter();
