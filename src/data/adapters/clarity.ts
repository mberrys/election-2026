import type { CandidateResult, Race, ReportingUnit, Tier, VoteModes } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { getBytes, getJson, getText, tryJson } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, slugify, type FeedCandidate } from "./util/names";
import { resolveContest } from "./util/race-id";
import { assembleRace, addModes, makeUnit } from "./util/race";
import { countyFips } from "./util/fips";
import { readZipEntry } from "./util/zip";

/**
 * Generic Clarity (Scytl / SOE) election-night adapter — a TypeScript port of
 * the discovery/parsing logic in openelections/clarify, using the JSON
 * endpoints first and `reports/detailxml.zip` as a fallback (no deps: zip
 * walked by hand, XML parsed by regex since the document is machine-generated).
 *
 * Verified 2026-10-30 for IA statewide (EID 127077, ver 382865; 2024 general EID 122322 ver 356043):
 *   200 /{ST}/elections.json                     [{ EID, ElectionName, Date, State, County }]
 *   200 /{ST}/{eid}/current_ver.txt              "382865"
 *   200 /{ST}/{eid}/{ver}/json/en/summary.json   [{ C: "United States Senator", K: "1000", CH: [names], P: [parties],
 *                                                   V: [votes], PCT: [...], PR/TP: reporting/participating units —
 *                                                   COUNTIES on a state instance (IA Senate TP=99), precincts on a
 *                                                   county instance; T: total votes (number, or [0] when staged),
 *                                                   W: [winner], IsRCV, CATKEY/CAT/SUBCAT, ... }]
 *   200 /{ST}/{eid}/{ver}/json/details.json      { Contests: [{ K, P: [county names], PX: [precincts reporting],
 *                                                   PY: [precincts total], V: [[votes per choice] per county],
 *                                                   T: [total per county], Eid/Cid: county Clarity ids }] }
 *   200 /{ST}/{eid}/{ver}/json/ALL.json          { Contests: [{ A: county, C: [contest keys], V: [[...]], T: [...] }] }
 *   200 /{ST}/{eid}/{ver}/json/status.json       { P: counties, PX, PY, S, R, B, C, ... }
 *   200 /{ST}/{eid}/{ver}/reports/detailxml.zip  detail.xml: <Contest key text precinctsParticipating precinctsReported>
 *                                                   <Choice key text party totalVotes><VoteType name votes><County name votes/>
 *   404 json/en/counties.json, json/en/index.json
 * Requests need a browser-like UA and Accept-Encoding: gzip (see util/http BROWSER_HEADERS).
 */
export interface ClarityConfig {
  id: string;
  state: string;
  /** Clarity election id, e.g. IA 2026 general 127077. */
  eid: string;
  tier: Tier;
  attribution: string;
  host?: string;
  /** Path segment after host: state code ("IA") or "IA/Polk" for county instances. */
  path?: string;
  /** "json" (default; no vote-method split) or "xml" (detailxml.zip; includes VoteType modes). */
  detail?: "json" | "xml";
  cadenceSec?: number;
}

export interface ClaritySummaryContest {
  C: string;
  K: string;
  CH: string[];
  P: string[];
  V: number[];
  PCT?: number[];
  PR?: number;
  TP?: number;
  T?: number | number[];
  W?: number[];
  IsRCV?: boolean | null;
}
export interface ClarityDetailContest {
  K: string;
  P: string[];
  PX: number[];
  PY: number[];
  V: number[][];
  T: number[];
}

/** Internal normalized form shared by the JSON and XML paths. */
export interface ClarityContest {
  key: string;
  name: string;
  choices: { name: string; party: string; votes: number; modes?: VoteModes }[];
  precinctsReporting?: number;
  precinctsTotal?: number;
  isRcv?: boolean;
  counties: { name: string; votes: number[]; precinctsReporting?: number; precinctsTotal?: number; modes?: VoteModes }[];
}

export function fromJson(summary: ClaritySummaryContest[], details: ClarityDetailContest[] | null): ClarityContest[] {
  const byKey = new Map((details ?? []).map((d) => [d.K, d]));
  return summary.map((s) => {
    const d = byKey.get(s.K);
    const counties: ClarityContest["counties"] = [];
    if (d) {
      d.P.forEach((name, ci) => {
        counties.push({
          name,
          votes: (d.V[ci] ?? []).map((v) => v ?? 0),
          precinctsReporting: d.PX[ci],
          precinctsTotal: d.PY[ci],
        });
      });
    }
    // For a state-level instance summary.json's PR/TP count COUNTIES reported/participating
    // (IA Senate: TP=99); real precinct counts come from details.json PX/PY per county.
    const sum = (xs: number[]) => xs.reduce((a, b) => a + (b ?? 0), 0);
    return {
      key: s.K,
      name: s.C,
      choices: s.CH.map((name, i) => ({ name, party: s.P[i] ?? "", votes: s.V[i] ?? 0 })),
      precinctsReporting: d ? sum(d.PX) : s.PR,
      precinctsTotal: d ? sum(d.PY) : s.TP,
      isRcv: !!s.IsRCV,
      counties,
    };
  });
}

const XML_ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
function unxml(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENT[m] ?? m).replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}
function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1] as string] = unxml(m[2] as string);
  return out;
}
function modeOf(voteType: string): keyof VoteModes | undefined {
  const n = voteType.toLowerCase();
  if (/election day/.test(n)) return "electionDay";
  if (/early|advance|in[- ]person/.test(n)) return "early";
  if (/absentee|mail/.test(n)) return "mail";
  if (/provisional/.test(n)) return "provisional";
  return undefined;
}

/** Parse Clarity detail.xml (regex-based; the file is machine-generated with double-quoted attributes). */
export function fromDetailXml(xml: string): ClarityContest[] {
  const out: ClarityContest[] = [];
  for (const cm of xml.matchAll(/<Contest\b([^>]*)>([\s\S]*?)<\/Contest>/g)) {
    const a = attrs(cm[1] as string);
    const body = cm[2] as string;
    const countyIdx = new Map<string, number>();
    const counties: ClarityContest["counties"] = [];
    const pc = body.match(/<ParticipatingCounties>([\s\S]*?)<\/ParticipatingCounties>/);
    if (pc) {
      for (const c of (pc[1] as string).matchAll(/<County\b([^>]*)\/>/g)) {
        const ca = attrs(c[1] as string);
        countyIdx.set(ca.name as string, counties.length);
        counties.push({
          name: ca.name as string,
          votes: [],
          precinctsReporting: Number(ca.precinctsReported ?? 0),
          precinctsTotal: Number(ca.precinctsParticipating ?? 0),
        });
      }
    }
    const choices: ClarityContest["choices"] = [];
    for (const ch of body.matchAll(/<Choice\b([^>]*)>([\s\S]*?)<\/Choice>/g)) {
      const ca = attrs(ch[1] as string);
      const ci = choices.length;
      const choice: ClarityContest["choices"][number] = {
        name: ca.text ?? "",
        party: ca.party ?? "",
        votes: Number(ca.totalVotes ?? 0),
        modes: {},
      };
      for (const vt of (ch[2] as string).matchAll(/<VoteType\b([^>]*)>([\s\S]*?)<\/VoteType>/g)) {
        const va = attrs(vt[1] as string);
        const mode = modeOf(va.name ?? "");
        if (mode) choice.modes = addModes(choice.modes, { [mode]: Number(va.votes ?? 0) }) ?? {};
        for (const c of (vt[2] as string).matchAll(/<County\b([^>]*)\/>/g)) {
          const cca = attrs(c[1] as string);
          let idx = countyIdx.get(cca.name as string);
          if (idx === undefined) {
            idx = counties.length;
            countyIdx.set(cca.name as string, idx);
            counties.push({ name: cca.name as string, votes: [] });
          }
          const county = counties[idx] as ClarityContest["counties"][number];
          county.votes[ci] = (county.votes[ci] ?? 0) + Number(cca.votes ?? 0);
          if (mode) county.modes = addModes(county.modes, { [mode]: Number(cca.votes ?? 0) });
        }
      }
      choices.push(choice);
    }
    for (const c of counties) for (let i = 0; i < choices.length; i++) c.votes[i] = c.votes[i] ?? 0;
    out.push({
      key: a.key ?? "",
      name: a.text ?? "",
      choices,
      precinctsReporting: a.precinctsReported !== undefined ? Number(a.precinctsReported) : undefined,
      precinctsTotal: a.precinctsParticipating !== undefined ? Number(a.precinctsParticipating) : undefined,
      counties,
    });
  }
  return out;
}

export function contestsToRaces(
  contests: ClarityContest[],
  cfg: Pick<ClarityConfig, "id" | "state" | "tier" | "attribution">,
  ctx: AdapterCtx,
  url: string,
): Race[] {
  const races: Race[] = [];
  for (const c of contests) {
    const resolved = resolveContest(c.name, cfg.state, cfg.id);
    if (!resolved) continue;
    const feed: FeedCandidate[] = c.choices.map((ch) => ({ name: ch.name, party: normalizeParty(ch.party), votes: ch.votes }));
    const candidates = matchCandidates(feed, ctx.metas.get(resolved.id));
    const units: ReportingUnit[] = c.counties.map((county) => {
      const votes: Record<string, number> = {};
      county.votes.forEach((v, i) => {
        const cid = (candidates[i] as CandidateResult | undefined)?.id ?? `choice-${i}`;
        votes[cid] = (votes[cid] ?? 0) + v;
      });
      const fips = countyFips(cfg.state, county.name);
      return makeUnit(
        {
          id: fips ?? slugify(county.name),
          name: county.name,
          ...(fips ? { fips } : {}),
          level: "county",
          ...(county.precinctsReporting !== undefined ? { precinctsReporting: county.precinctsReporting } : {}),
          ...(county.precinctsTotal !== undefined ? { precinctsTotal: county.precinctsTotal } : {}),
          ...(county.modes ? { modes: county.modes } : {}),
        },
        votes,
      );
    });
    let modes: VoteModes | undefined;
    for (const ch of c.choices) modes = addModes(modes, ch.modes);
    races.push(
      assembleRace({
        ...resolved,
        candidates,
        units,
        precinctsReporting: c.precinctsReporting,
        precinctsTotal: c.precinctsTotal,
        modes,
        source: { adapter: cfg.id, tier: cfg.tier, url, attribution: c.isRcv ? `${cfg.attribution} — RCV first choices` : cfg.attribution },
        ctx,
      }),
    );
  }
  return races;
}

export function makeClarityAdapter(cfg: ClarityConfig): Adapter {
  const host = cfg.host ?? "https://results.enr.clarityelections.com";
  const path = cfg.path ?? cfg.state.toUpperCase();
  const root = `${host}/${path}/${cfg.eid}`;
  return {
    id: cfg.id,
    tier: cfg.tier,
    states: [cfg.state],
    cadenceSec: cfg.cadenceSec ?? 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const ver = (await getText(ctx, `${root}/current_ver.txt`)).trim();
      if (!/^\d+$/.test(ver)) throw new Error(`unexpected current_ver "${ver.slice(0, 20)}"`);
      const base = `${root}/${ver}`;
      let contests: ClarityContest[] | null = null;
      let url = `${base}/json/en/summary.json`;

      if ((cfg.detail ?? "json") === "json") {
        const summary = await tryJson<ClaritySummaryContest[]>(ctx, url);
        if (summary) {
          const details = await tryJson<{ Contests: ClarityDetailContest[] }>(ctx, `${base}/json/details.json`);
          if (!details) ctx.log("details.json unavailable; races will have no county units");
          contests = fromJson(summary, details?.Contests ?? null);
        }
      }
      if (!contests) {
        url = `${base}/reports/detailxml.zip`;
        const zip = await getBytes(ctx, url);
        const xml = readZipEntry(zip, /detail\.xml$/i);
        if (!xml) throw new Error("detailxml.zip has no detail.xml");
        contests = fromDetailXml(new TextDecoder().decode(xml));
      }
      const races = contestsToRaces(contests, cfg, ctx, url);
      ctx.log(`ver ${ver}: ${races.length} races from ${contests.length} contests`);
      return races;
    },
  };
}

/** List a state's Clarity elections (discovery helper; `--compressed` semantics via BROWSER_HEADERS). */
export async function listClarityElections(ctx: AdapterCtx, state: string, host = "https://results.enr.clarityelections.com") {
  return getJson<{ EID: string; ElectionName: string; Date: string; State: string; County: string }[]>(ctx, `${host}/${state}/elections.json`);
}

export const iaClarity = makeClarityAdapter({
  id: "clarity-ia",
  state: "IA",
  eid: "127077",
  tier: "A",
  attribution: "Iowa Secretary of State",
});
