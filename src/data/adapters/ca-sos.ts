import type { CandidateResult, Race, ReportingUnit } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { mapPool, num, tryJson } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, type FeedCandidate } from "./util/names";
import { ballotRaceId, resolveContest } from "./util/race-id";
import { assembleRace, makeUnit } from "./util/race";
import { countyFips } from "./util/fips";

/**
 * California Secretary of State returns API (api.sos.ca.gov). No key, curl OK.
 *
 * Verified 2026-10-30 (HTTP):
 *   200 /returns/governor                       200 /returns/ballot-measures      200 /returns/status
 *   200 /returns/governor/county/{slug}         200 /returns/us-rep/district/{1..52}   (53 → 500)
 *   200 /returns/us-rep/district/{n}/county/{slug}
 *   500 /returns/us-rep, /returns/us-senate, /returns/state-senate, /returns/assembly   (list routes broken)
 *   403 /returns (API Gateway "Missing Authentication Token")
 * There is no U.S. Senate race in CA in 2026, so /returns/us-senate is not polled.
 * Numbers currently served are SoS test data (e.g. Becerra 1,125 votes, 2.5% precincts).
 *
 * Shapes:
 *   race   { raceTitle: "Governor - Statewide Results",
 *            Reporting: "2.5% (588 of 23,860) precincts reporting", ReportingTime: "October 30, 2026, 4:39 p.m.",
 *            candidates: [{ Name, Party: "Dem"|"Rep"|"NPP"|..., Votes: "1,125", Percent: "53.6", incumbent }] }
 *   county race: an ARRAY [countyRace, statewideRace] with raceTitle "Governor - Alameda County Results".
 *   ballot-measures { raceTitle, Reporting, ReportingTime,
 *            "ballot-measures": [{ Name, Number: "01", yesVotes: "1414", yesPercent, noVotes, noPercent }] }
 *   status  { [countySlug]: { county: 1, precinctsReporting: "213", precinctsTotal: "570",
 *            voterTurnout: "251637", totalRegisteredVoters: "945115", countyName: "Alameda", timestamp, ... },
 *            statewide: {...} }
 */
export interface CaRace {
  raceTitle: string;
  Reporting: string;
  ReportingTime: string | null;
  candidates: { Name: string; Party: string; Votes: string; Percent: string; incumbent: boolean }[];
}
export interface CaBallotMeasures {
  raceTitle: string;
  Reporting: string;
  ReportingTime: string | null;
  "ballot-measures": { Name: string; Number: string; yesVotes: string; yesPercent: string; noVotes: string; noPercent: string }[];
}
export type CaStatus = Record<
  string,
  {
    county: number;
    precinctsReporting: string;
    precinctsTotal: string;
    voterTurnout: string;
    totalRegisteredVoters: string;
    countyName: string;
    timestamp: string;
  }
>;

export interface CaConfig {
  id?: string;
  base?: string;
  /** House districts to poll; default: from metas (house:CA-NN) else 1..52. */
  districts?: number[];
  /** Pull governor county breakdowns (58 requests). Default true. */
  counties?: boolean;
  concurrency?: number;
  cadenceSec?: number;
}

const ATTRIBUTION = "California Secretary of State";

export function parseReporting(s: string | undefined): { reporting?: number; total?: number } {
  const m = s?.match(/\(([\d,]+)\s+of\s+([\d,]+)\)/);
  if (!m) return {};
  return { reporting: num(m[1]), total: num(m[2]) };
}

export function makeCaAdapter(config: CaConfig = {}): Adapter {
  const id = config.id ?? "ca-sos";
  const base = config.base ?? "https://api.sos.ca.gov/returns";
  const concurrency = config.concurrency ?? 8;

  return {
    id,
    tier: "A",
    states: ["CA"],
    cadenceSec: config.cadenceSec ?? 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const races: Race[] = [];
      const [gov, measures, status] = await Promise.all([
        tryJson<CaRace>(ctx, `${base}/governor`),
        tryJson<CaBallotMeasures>(ctx, `${base}/ballot-measures`),
        tryJson<CaStatus>(ctx, `${base}/status`),
      ]);
      if (!gov && !measures) throw new Error("governor and ballot-measures both unavailable");

      // ---- Governor (+ county units) ----
      if (gov) {
        const resolved = resolveContest(gov.raceTitle, "CA", id);
        if (resolved) {
          const feed: FeedCandidate[] = gov.candidates.map((c) => ({
            name: c.Name,
            party: normalizeParty(c.Party),
            votes: num(c.Votes),
            incumbent: c.incumbent,
          }));
          const candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
          const idByName = new Map(gov.candidates.map((c, i) => [c.Name, (candidates[i] as CandidateResult).id]));
          const units: ReportingUnit[] = [];
          if ((config.counties ?? true) && status) {
            const slugs = Object.keys(status).filter((k) => k !== "statewide");
            const perCounty = await mapPool(slugs, concurrency, (slug) =>
              tryJson<CaRace[] | CaRace>(ctx, `${base}/governor/county/${slug}`),
            );
            perCounty.forEach((res, i) => {
              const slug = slugs[i] as string;
              const st = status[slug];
              const county = Array.isArray(res) ? res.find((r) => !/statewide/i.test(r.raceTitle)) : res;
              if (!county || !st) return;
              const votes: Record<string, number> = {};
              for (const c of county.candidates) {
                const cid = idByName.get(c.Name);
                if (cid) votes[cid] = (votes[cid] ?? 0) + num(c.Votes);
              }
              const fips = countyFips("CA", st.countyName ?? slug.replace(/-/g, " "));
              const rep = parseReporting(county.Reporting);
              units.push(
                makeUnit(
                  {
                    id: fips ?? slug,
                    name: st.countyName ?? slug,
                    ...(fips ? { fips } : {}),
                    level: "county",
                    precinctsReporting: rep.reporting ?? num(st.precinctsReporting),
                    precinctsTotal: rep.total ?? num(st.precinctsTotal),
                  },
                  votes,
                ),
              );
            });
          }
          const rep = parseReporting(gov.Reporting);
          races.push(
            assembleRace({
              ...resolved,
              candidates,
              units,
              precinctsReporting: rep.reporting,
              precinctsTotal: rep.total,
              source: { adapter: id, tier: "A", url: `${base}/governor`, attribution: ATTRIBUTION },
              ctx,
            }),
          );
        }
      }

      // ---- Ballot measures ----
      if (measures) {
        const rep = parseReporting(measures.Reporting);
        for (const m of measures["ballot-measures"]) {
          const n = m.Number.replace(/^0+(?=\d)/, "");
          races.push(
            assembleRace({
              id: ballotRaceId("CA", `prop-${m.Number}`),
              office: "ballot",
              state: "CA",
              district: `prop-${m.Number}`,
              name: `CA Proposition ${n}: ${m.Name}`,
              candidates: [
                { id: "yes", name: "Yes", party: "O", votes: num(m.yesVotes), pct: 0 },
                { id: "no", name: "No", party: "O", votes: num(m.noVotes), pct: 0 },
              ],
              precinctsReporting: rep.reporting,
              precinctsTotal: rep.total,
              source: { adapter: id, tier: "A", url: `${base}/ballot-measures`, attribution: ATTRIBUTION },
              ctx,
            }),
          );
        }
      }

      // ---- U.S. House by district (list route /us-rep returns 500; per-district works) ----
      const districts =
        config.districts ??
        (() => {
          const fromMeta = [...ctx.metas.keys()]
            .map((k) => k.match(/^house:CA-(\d{2})$/)?.[1])
            .filter((d): d is string => !!d)
            .map(Number);
          return fromMeta.length ? fromMeta : Array.from({ length: 52 }, (_, i) => i + 1);
        })();
      const houseRaces = await mapPool(districts, concurrency, (d) => tryJson<CaRace>(ctx, `${base}/us-rep/district/${d}`));
      houseRaces.forEach((hr, i) => {
        if (!hr) return;
        const d = districts[i] as number;
        const resolved = resolveContest(hr.raceTitle, "CA", id) ?? resolveContest(`U.S. House of Representatives District ${d}`, "CA", id);
        if (!resolved) return;
        const feed: FeedCandidate[] = hr.candidates.map((c) => ({
          name: c.Name,
          party: normalizeParty(c.Party),
          votes: num(c.Votes),
          incumbent: c.incumbent,
        }));
        const rep = parseReporting(hr.Reporting);
        races.push(
          assembleRace({
            ...resolved,
            candidates: matchCandidates(feed, ctx.metas.get(resolved.id)),
            precinctsReporting: rep.reporting,
            precinctsTotal: rep.total,
            source: { adapter: id, tier: "A", url: `${base}/us-rep/district/${d}`, attribution: ATTRIBUTION },
            ctx,
          }),
        );
      });

      ctx.log(`${races.length} races (governor=${!!gov}, measures=${measures?.["ballot-measures"].length ?? 0}, house=${houseRaces.filter(Boolean).length}/${districts.length})`);
      return races;
    },
  };
}

export const caSos = makeCaAdapter();
