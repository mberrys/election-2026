import type { CandidateResult, Race, ReportingUnit, Tier, VoteModes } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { getJson, tryJson } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, slugify, type FeedCandidate } from "./util/names";
import { ballotRaceId, resolveContest, type ResolvedContest } from "./util/race-id";
import { assembleRace, addModes, makeUnit } from "./util/race";
import { countyFips, STATE_FIPS } from "./util/fips";

/**
 * Generic Enhanced Voting (EV) adapter — VA and GA statewide; also usable for
 * county EV instances (`app.enhancedvoting.com/cdn/results/{county}-county-{st}/export-{slug}.json`).
 *
 * Endpoints (verified 2026-10-30, no auth):
 *   discovery  GET {host}/results/public/api/jurisdictions/{jurisdiction}
 *              → { elections: [{ publicElectionId, electionDate: "YYYY-MM-DD", name: [{languageId,text}] }], ... }
 *              VA lists "2026-November-General" (2026-11-03); GA's newest entry is 2026-08-25 — the Nov 3
 *              general is NOT published yet, so GA resolves via env GA_ELECTION_SLUG until it appears.
 *   election   GET {host}/results/public/api/elections/{jurisdiction}/{slug}
 *              → { isOfficialResults, lastUpdated, asOf, countGroups[], totalVoters, ballotsCast, ... }
 *   export     GET {host}/cdn/results/{jurisdiction}/export-{slug}.json  (one request, whole state;
 *              VA 2026 = 26 MB live, GA 2024 = 34 MB — gzip on the wire ≈ 0.8–3 MB)
 *
 * Export shape (documented from VA 2026 / VA 2025 / GA 2024NovGen):
 *   {
 *     electionDate: "2026-11-03", electionName, createdAt,
 *     results: {                               // statewide roll-up
 *       id, name: "Virginia",
 *       ballotItems: [{
 *         type: "State", id: "cc142", name: "Member, United States Senate", voteFor: 1, ballotOrder,
 *         precinctsParticipating: null, precinctsReporting: null,      // null at state level → sum localities
 *         contestType: "Candidate" | "Referendum" | ...,
 *         ballotOptions: [{
 *           id: "cs290", name: "Mark R. Warner" (GA: "Donald J. Trump (Rep)"), ballotOrder, voteCount,
 *           politicalParty: "Democratic" | "Rep" | null,
 *           groupResults: [{ groupName: "Early Voting"|"Election Day"|"Mailed Absentee"|"Provisional"|
 *                            "Post-Election" (VA) | "Advanced Voting"|"Absentee by Mail" (GA), voteCount }],
 *           precinctResults: null
 *         }],
 *         rankedChoiceResults: null
 *       }],
 *       reportingStatuses: null | [{ groupName, status }]
 *     },
 *     localResults: [{                         // one per locality (VA: 133 counties+cities, GA: 159 counties)
 *       id: "071" (VA = 3-digit county FIPS suffix) | GUID (GA), name: "GILES COUNTY" | "Fulton County",
 *       ballotItems: [ same shape, type "State"|"Local", precinctsParticipating/Reporting populated,
 *                      ballotOptions[].precinctResults: [{ id, name, voteCount, reportingStatus, groupResults }] ],
 *       reportingStatuses: [{ groupName, status: "Fully Reported" | ... }]
 *     }]
 *   }
 */

export interface EvExport {
  electionDate: string;
  electionName: string;
  createdAt: string;
  results: EvJurisdictionResults;
  localResults: EvJurisdictionResults[];
}
export interface EvJurisdictionResults {
  id: string;
  name: string;
  ballotItems: EvBallotItem[];
  reportingStatuses: { groupName: string; status: string }[] | null;
}
export interface EvBallotItem {
  type: string;
  id: string;
  name: string;
  voteFor: number;
  ballotOrder: number;
  precinctsParticipating: number | null;
  precinctsReporting: number | null;
  contestType: string;
  ballotOptions: EvBallotOption[];
  rankedChoiceResults: unknown;
}
export interface EvBallotOption {
  id: string;
  name: string;
  ballotOrder: number;
  voteCount: number;
  politicalParty: string | null;
  groupResults: { groupName: string; voteCount: number | null; isFromVirtualPrecinct?: boolean }[] | null;
  precinctResults: unknown;
}
export interface EvJurisdiction {
  elections: { publicElectionId: string; electionDate: string; name: { languageId: string; text: string }[] }[];
}
export interface EvElectionMeta {
  isOfficialResults: boolean;
  lastUpdated: string;
  asOf: string;
}

export interface EnhancedVotingConfig {
  id: string;
  state: string;
  tier: Tier;
  host: string;
  /** Path segment: "virginia", "Georgia". */
  jurisdiction: string;
  /** Known slug; when absent, `slugEnv` then discovery by `electionDate`. */
  electionSlug?: string;
  slugEnv?: string;
  electionDate: string;
  attribution: string;
  cadenceSec?: number;
  /** Locality → county FIPS. Default: VA-style numeric id or name lookup. */
  localityFips?: (loc: { id: string; name: string }, state: string) => string | undefined;
  /** Include referendum-type items as `ballot:` races. Default true. */
  ballotMeasures?: boolean;
}

export function modesFromGroups(groups: EvBallotOption["groupResults"]): VoteModes | undefined {
  if (!groups) return undefined;
  const m: VoteModes = {};
  for (const g of groups) {
    const v = g.voteCount ?? 0;
    const n = g.groupName.toLowerCase();
    if (/early|advance/.test(n)) m.early = (m.early ?? 0) + v;
    else if (/election day/.test(n)) m.electionDay = (m.electionDay ?? 0) + v;
    else if (/mail|absentee/.test(n)) m.mail = (m.mail ?? 0) + v;
    else if (/provisional/.test(n)) m.provisional = (m.provisional ?? 0) + v;
    // "Post-Election" (VA late mail/cured) is counted in totals but not attributed to a mode.
  }
  return m;
}

function defaultLocalityFips(loc: { id: string; name: string }, state: string): string | undefined {
  const st = STATE_FIPS[state];
  if (st && /^\d{3}$/.test(loc.id)) return `${st}${loc.id}`;
  return countyFips(state, loc.name);
}

/** Strip GA's "(Rep)" suffix from option names. */
export function cleanOptionName(name: string): string {
  return name.replace(/\s*\((?:Dem|Rep|Lib|Grn|Ind|Green|I|D|R|L|G|NP|[A-Z][A-Za-z]{1,3})\)\s*$/, "").trim();
}

export async function discoverSlug(
  ctx: AdapterCtx,
  host: string,
  jurisdiction: string,
  electionDate: string,
): Promise<string | undefined> {
  const j = await tryJson<EvJurisdiction>(ctx, `${host}/results/public/api/jurisdictions/${jurisdiction}`);
  if (!j?.elections) return undefined;
  const sameDay = j.elections.filter((e) => e.electionDate === electionDate);
  // Prefer the general over same-day recounts/specials.
  const general = sameDay.find((e) => /general/i.test(e.name?.[0]?.text ?? "") && !/recount/i.test(e.name?.[0]?.text ?? ""));
  return (general ?? sameDay[0])?.publicElectionId;
}

export function parseExport(
  exp: EvExport,
  cfg: Pick<EnhancedVotingConfig, "id" | "state" | "tier" | "attribution" | "localityFips" | "ballotMeasures">,
  ctx: AdapterCtx,
  url: string,
  certified = false,
): Race[] {
  const races: Race[] = [];
  const fipsFor = cfg.localityFips ?? defaultLocalityFips;

  for (const item of exp.results.ballotItems) {
    const isCandidate = item.contestType === "Candidate" || item.ballotOptions.some((o) => o.politicalParty);
    let resolved: ResolvedContest | null = null;
    if (isCandidate) {
      resolved = resolveContest(item.name, cfg.state, cfg.id);
    } else if (cfg.ballotMeasures ?? true) {
      const q = item.name.match(/(?:question|amendment|proposition|measure)\s*(?:no\.?\s*)?(\d+)/i);
      const slug = q ? `${/amendment/i.test(item.name) ? "amendment" : "question"}-${q[1]}` : slugify(item.name).slice(0, 40);
      resolved = {
        id: ballotRaceId(cfg.state, slug),
        office: "ballot",
        state: cfg.state,
        district: slug,
        special: false,
        name: item.name,
      };
    }
    if (!resolved) continue;

    const feed: FeedCandidate[] = item.ballotOptions.map((o) => ({
      name: cleanOptionName(o.name),
      party: normalizeParty(o.politicalParty),
      votes: o.voteCount ?? 0,
    }));
    let candidates: CandidateResult[];
    if (resolved.office === "ballot") {
      candidates = item.ballotOptions.map((o, i) => ({
        id: slugify(o.name) || `option-${i + 1}`,
        name: o.name,
        party: "O" as const,
        votes: o.voteCount ?? 0,
        pct: 0,
      }));
    } else {
      candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
    }
    const candIdByOption = new Map<string, string>();
    item.ballotOptions.forEach((o, i) => candIdByOption.set(o.id, (candidates[i] as CandidateResult).id));

    let modes: VoteModes | undefined;
    for (const o of item.ballotOptions) modes = addModes(modes, modesFromGroups(o.groupResults));

    const units: ReportingUnit[] = [];
    let pr = 0;
    let pt = 0;
    let anyPrecincts = false;
    for (const loc of exp.localResults) {
      const li = loc.ballotItems.find((b) => b.id === item.id);
      if (!li) continue;
      const votes: Record<string, number> = {};
      let umodes: VoteModes | undefined;
      for (const o of li.ballotOptions) {
        const cid = candIdByOption.get(o.id) ?? slugify(cleanOptionName(o.name));
        votes[cid] = (votes[cid] ?? 0) + (o.voteCount ?? 0);
        umodes = addModes(umodes, modesFromGroups(o.groupResults));
      }
      const fips = fipsFor({ id: loc.id, name: loc.name }, cfg.state);
      if (li.precinctsParticipating != null) {
        anyPrecincts = true;
        pt += li.precinctsParticipating;
        pr += li.precinctsReporting ?? 0;
      }
      units.push(
        makeUnit(
          {
            id: fips ?? slugify(loc.name),
            name: titleCaseLocality(loc.name),
            ...(fips ? { fips } : {}),
            level: "county",
            ...(li.precinctsParticipating != null ? { precinctsTotal: li.precinctsParticipating } : {}),
            ...(li.precinctsReporting != null ? { precinctsReporting: li.precinctsReporting } : {}),
            ...(umodes ? { modes: umodes } : {}),
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
        precinctsReporting: item.precinctsReporting ?? (anyPrecincts ? pr : undefined),
        precinctsTotal: item.precinctsParticipating ?? (anyPrecincts ? pt : undefined),
        modes,
        certified,
        source: { adapter: cfg.id, tier: cfg.tier, url, attribution: cfg.attribution },
        ctx,
      }),
    );
  }
  return races;
}

function titleCaseLocality(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and");
}

export function makeEnhancedVotingAdapter(cfg: EnhancedVotingConfig): Adapter {
  return {
    id: cfg.id,
    tier: cfg.tier,
    states: [cfg.state],
    cadenceSec: cfg.cadenceSec ?? 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const slug =
        cfg.electionSlug ??
        (cfg.slugEnv ? process.env[cfg.slugEnv] : undefined) ??
        (await discoverSlug(ctx, cfg.host, cfg.jurisdiction, cfg.electionDate));
      if (!slug) {
        throw new Error(
          `${cfg.id}: no election slug for ${cfg.jurisdiction} ${cfg.electionDate} (not yet published; set ${cfg.slugEnv ?? "electionSlug"})`,
        );
      }
      const exportUrl = `${cfg.host}/cdn/results/${cfg.jurisdiction}/export-${slug}.json`;
      const metaUrl = `${cfg.host}/results/public/api/elections/${cfg.jurisdiction}/${slug}`;
      const [exp, meta] = await Promise.all([getJson<EvExport>(ctx, exportUrl), tryJson<EvElectionMeta>(ctx, metaUrl)]);
      const races = parseExport(exp, cfg, ctx, exportUrl, meta?.isOfficialResults === true);
      ctx.log(`${slug}: ${races.length} races, ${exp.localResults.length} localities, official=${meta?.isOfficialResults ?? "?"}`);
      return races;
    },
  };
}

export const vaEnhancedVoting = makeEnhancedVotingAdapter({
  id: "ev-va",
  state: "VA",
  tier: "A",
  host: "https://enr.elections.virginia.gov",
  jurisdiction: "virginia",
  electionSlug: "2026-November-General",
  electionDate: "2026-11-03",
  attribution: "Virginia Department of Elections",
});

/**
 * GA: the Nov 3 2026 slug is not published as of 2026-10-30 (jurisdiction list
 * stops at 08252026SpecialElectionRunoff). Discovery runs each cycle; override
 * with GA_ELECTION_SLUG once known. 2024 slug for fixtures: 2024NovGen.
 */
export const gaEnhancedVoting = makeEnhancedVotingAdapter({
  id: "ev-ga",
  state: "GA",
  tier: "A",
  host: "https://results.sos.ga.gov",
  jurisdiction: "Georgia",
  slugEnv: "GA_ELECTION_SLUG",
  electionDate: "2026-11-03",
  attribution: "Georgia Secretary of State",
});
