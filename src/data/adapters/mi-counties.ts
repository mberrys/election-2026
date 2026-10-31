import type { Race } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { discoverSlug } from "./enhanced-voting";
import { fromJson, type ClaritySummaryContest } from "./clarity";
import { getJson, getText, HttpError, mapPool, num } from "./util/http";
import { normalizeParty } from "./util/party";
import { ballotRaceId, resolveContest, type ResolvedContest } from "./util/race-id";
import {
  choicesFromEvApi,
  countyFipsRef,
  CountyRollup,
  enText,
  stateCountyFips,
  type CountyChoice,
  type EvApiOption,
  type EvText,
} from "./az-mi-wa-shared";

/**
 * Michigan — assembled from county feeds (tier B). There is no reachable statewide feed: the
 * Bureau of Elections ENR host mielections.us times out from here (TCP connect, 2026-10-30), and
 * michigan.gov only links certified PDFs. Coverage is 28 of 83 counties (see MI_EV_COUNTIES,
 * MI_CLARITY_COUNTIES, Wayne); every other county is padded as not reporting by `CountyRollup`.
 *
 * Verified 2026-10-30 (all 200, staged 0 votes):
 *   Enhanced Voting, 21 counties — public API, ≈10–25 KB gzip per county:
 *     GET https://app.enhancedvoting.com/results/public/api/elections/{county}-county-mi/{slug}/ballot-items
 *     → { data: [{ name: [{text}], contestType, reportingStatus{reportingUnits,totalUnits = precincts},
 *                  summaryResults.ballotOptions[{ name, voteCount, party.name, groupResults[{groupName,voteCount}] }] }] }
 *     The county CDN exports (`/cdn/results/{county}-county-mi/export-{slug}.json`) carry the same totals but are
 *     0.3–10 MB uncompressed (Kent 10 MB) with empty localResults, so the API is used. On a 404 the slug is
 *     re-discovered from `/results/public/api/jurisdictions/{county}-county-mi` by election date.
 *   Clarity, 6 counties — `results.enr.clarityelections.com/MI/{County}/{eid}/current_ver.txt` then
 *     `/{ver}/json/en/summary.json` (county totals; PR/TP = precincts). Names carry party prefixes ("DEM Jocelyn Benson").
 *   Wayne — michigan.totalvote.com/Wayne (server-rendered ASP.NET; no JSON). Pages ResultsSW.aspx?type=ST|CON|PRP
 *     hold Governor, US Senate + US House, and state proposals with "Precincts Reported: x / 770".
 *
 * Contest spellings seen: "Governor and Lieutenant Governor" / "Governor & Lieutenant Governor" / "Governor and
 * Lt. Governor"; "United States Senator"; "Representative in Congress 4th District" / "- 2nd District" /
 * "District 7" / ", 1st District"; "State Proposal 2026-1" / "Proposal 2026-01" / "Proposal 2026-2 - State of
 * Michigan". "Governor of Wayne State University" must NOT resolve to governor:MI.
 */

const ID = "mi-counties";
const EV_HOST = "https://app.enhancedvoting.com";
const CLARITY_HOST = "https://results.enr.clarityelections.com";
const WAYNE_HOST = "https://michigan.totalvote.com";
const ELECTION_DATE = "2026-11-03";

/** [EV jurisdiction, 2026-11-03 publicElectionId] — all verified 2026-10-30. */
export const MI_EV_COUNTIES: [string, string][] = [
  ["berrien-county-mi", "November_3_2026_General_Election"],
  ["branch-county-mi", "2026NovemberGeneral"],
  ["clare-county-mi", "2026_General_ClareCounty_Results"],
  ["delta-county-mi", "november2026election"],
  ["gratiot-county-mi", "GratiotCountyNovemberElection"],
  ["ingham-county-mi", "NovemberElection11032026"],
  ["iosco-county-mi", "NovemberGeneral2026"],
  ["isabella-county-mi", "2026NovemberGeneral"],
  ["kalamazoo-county-mi", "2026-General-Election"],
  ["kent-county-mi", "11032026_20261005115447"],
  ["lake-county-mi", "Nov-26-General"],
  ["leelanau-county-mi", "20261103_LeelanauNovember2026General"],
  ["midland-county-mi", "November_3_2026"],
  ["monroe-county-mi", "November2026Election"],
  ["newaygo-county-mi", "2026NovemberGeneralElection"],
  ["osceola-county-mi", "November2026"],
  ["saginaw-county-mi", "_20261016111322"],
  ["shiawassee-county-mi", "11032026GeneralElection"],
  ["st.-clair-county-mi", "November2026GeneralElection_20260928112331"],
  ["st.-joseph-county-mi", "2026_state_general_results"],
  ["van-buren-county-mi", "November2026"],
];

/** [Clarity path segment, EID] — verified 2026-10-30. */
export const MI_CLARITY_COUNTIES: [string, string][] = [
  ["Emmet", "127403"],
  ["Genesee", "127354"],
  ["Macomb", "127293"],
  ["Oakland", "127284"],
  ["Ottawa", "127391"],
  ["Roscommon", "127296"],
];

export const WAYNE_PAGES = ["ST", "CON", "PRP"] as const;

/** One contest's county-level totals as read from any MI county feed. */
export interface MiFeedContest {
  name: string;
  choices: CountyChoice[];
  precinctsReporting?: number;
  precinctsTotal?: number;
}

/** MI county contest name → race identity, or null for everything off the board. */
export function classifyMiContest(raw: string): ResolvedContest | null {
  const n = raw
    .replace(/\s*-?\s*vote\s+for\s+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^governor\s*(?:and|&)\s*(?:lt\.?|lieutenant)\s*governor\b/i.test(n)) return resolveContest("Governor", "MI", ID);
  if (/^(?:united\s+states|u\.?\s?s\.?)\s+senator\b/i.test(n)) return resolveContest(n, "MI", ID);
  const h = n.match(/^representative\s+in\s+congress\b(.*)$/i);
  if (h) {
    const d = (h[1] ?? "").match(/(\d{1,2})/);
    return d ? resolveContest(`U.S. Representative District ${d[1]}`, "MI", ID) : null;
  }
  // Statewide proposals are numbered "<year>-<n>"; local proposals never are.
  const p = n.match(/^(?:state\s+)?proposal\s+20\d\d-0*(\d+)\b/i);
  if (p) {
    const district = `proposal-${p[1]}`;
    return { id: ballotRaceId("MI", district), office: "ballot", state: "MI", district, special: false, name: `Proposal ${p[1]}` };
  }
  return null;
}

// ---------- Enhanced Voting (county API) ----------

interface EvApiBallotItem {
  name: EvText;
  contestType: string;
  reportingStatus: { reportingUnits: number | null; totalUnits: number | null } | null;
  summaryResults: { ballotOptions: EvApiOption[] } | null;
}

export function contestsFromEvApi(items: EvApiBallotItem[]): MiFeedContest[] {
  return items.map((b) => ({
    name: enText(b.name),
    choices: choicesFromEvApi(b.summaryResults?.ballotOptions ?? []),
    ...(b.reportingStatus?.totalUnits
      ? { precinctsTotal: b.reportingStatus.totalUnits, precinctsReporting: b.reportingStatus.reportingUnits ?? 0 }
      : {}),
  }));
}

async function fetchEvCounty(ctx: AdapterCtx, jurisdiction: string, slug: string): Promise<{ url: string; contests: MiFeedContest[] }> {
  const url = (s: string) => `${EV_HOST}/results/public/api/elections/${jurisdiction}/${s}/ballot-items`;
  try {
    const u = url(slug);
    return { url: u, contests: contestsFromEvApi((await getJson<{ data: EvApiBallotItem[] }>(ctx, u)).data) };
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 404)) throw err;
    const found = await discoverSlug(ctx, EV_HOST, jurisdiction, ELECTION_DATE);
    if (!found || found === slug) throw err;
    ctx.log(`${jurisdiction}: slug ${slug} 404, using discovered ${found}`);
    const u = url(found);
    return { url: u, contests: contestsFromEvApi((await getJson<{ data: EvApiBallotItem[] }>(ctx, u)).data) };
  }
}

// ---------- Clarity (county instance) ----------

const CLARITY_PARTY_PREFIX = /^(?:DEM|REP|LIB|UST|GRN|GRE|NLP|WCP|WC|NPA|NON)\s+(?=\S)/;

export function contestsFromClaritySummary(summary: ClaritySummaryContest[]): MiFeedContest[] {
  return fromJson(summary, null).map((c) => ({
    name: c.name,
    choices: c.choices
      .filter((ch) => !/rejected/i.test(ch.name))
      .map((ch) => ({ name: ch.name.replace(CLARITY_PARTY_PREFIX, "").trim(), party: normalizeParty(ch.party), votes: ch.votes })),
    ...(c.precinctsTotal ? { precinctsTotal: c.precinctsTotal, precinctsReporting: c.precinctsReporting ?? 0 } : {}),
  }));
}

async function fetchClarityCounty(ctx: AdapterCtx, county: string, eid: string): Promise<{ url: string; contests: MiFeedContest[] }> {
  const root = `${CLARITY_HOST}/MI/${county}/${eid}`;
  const ver = (await getText(ctx, `${root}/current_ver.txt`)).trim();
  if (!/^\d+$/.test(ver)) throw new Error(`unexpected current_ver "${ver.slice(0, 20)}"`);
  const url = `${root}/${ver}/json/en/summary.json`;
  return { url, contests: contestsFromClaritySummary(await getJson<ClaritySummaryContest[]>(ctx, url)) };
}

// ---------- Wayne (TotalVote HTML) ----------

function stripTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a TotalVote ResultsSW.aspx page into contests (county totals). */
export function parseTotalVote(html: string): MiFeedContest[] {
  const out: MiFeedContest[] = [];
  const blocks = html.split(/<div class="display-results-box-a">/).slice(1);
  for (const block of blocks) {
    const title = block.match(/<h1>([\s\S]*?)<\/h1>/);
    if (!title) continue;
    const pr = block.match(/Precincts Reported:\s*([\d,]+)\s*\/\s*([\d,]+)/);
    const choices: CountyChoice[] = [];
    for (const m of block.matchAll(
      /display-results-box-d">\s*<h1>([\s\S]*?)<\/h1>\s*<h2 class="[^"]*">([\s\S]*?)<\/h2>[\s\S]*?display-results-box-f">\s*<h1>([\s\S]*?)<\/h1>/g,
    )) {
      const name = stripTags(m[1] ?? "");
      if (!name || /rejected/i.test(name)) continue;
      choices.push({ name, party: normalizeParty(stripTags(m[2] ?? "")), votes: num(stripTags(m[3] ?? "")) });
    }
    out.push({
      name: stripTags(title[1] ?? ""),
      choices,
      ...(pr ? { precinctsReporting: num(pr[1]), precinctsTotal: num(pr[2]) } : {}),
    });
  }
  return out;
}

async function fetchWayne(ctx: AdapterCtx): Promise<{ url: string; contests: MiFeedContest[] }> {
  const pages = await Promise.all(
    WAYNE_PAGES.map((t) => getText(ctx, `${WAYNE_HOST}/Wayne/ResultsSW.aspx?type=${t}&cid=05&map=CTY`)),
  );
  return { url: `${WAYNE_HOST}/Wayne`, contests: pages.flatMap(parseTotalVote) };
}

// ---------- adapter ----------

export interface CountySource {
  county: string;
  kind: "ev" | "clarity" | "totalvote";
  load: (ctx: AdapterCtx) => Promise<{ url: string; contests: MiFeedContest[] }>;
}

function evCountyName(jurisdiction: string): string {
  return jurisdiction
    .replace(/-county-mi$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function evSource(jurisdiction: string, slug: string): CountySource {
  return { county: evCountyName(jurisdiction), kind: "ev", load: (ctx) => fetchEvCounty(ctx, jurisdiction, slug) };
}
export function claritySource(county: string, eid: string): CountySource {
  return { county, kind: "clarity", load: (ctx) => fetchClarityCounty(ctx, county, eid) };
}
export const wayneSource: CountySource = { county: "Wayne", kind: "totalvote", load: fetchWayne };

export const MI_SOURCES: CountySource[] = [
  ...MI_EV_COUNTIES.map(([j, slug]) => evSource(j, slug)),
  ...MI_CLARITY_COUNTIES.map(([c, eid]) => claritySource(c, eid)),
  wayneSource,
];

export function makeMiCountiesAdapter(sources: CountySource[] = MI_SOURCES, concurrency = 4): Adapter {
  return {
    id: ID,
    tier: "B",
    states: ["MI"],
    cadenceSec: 90,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const results = await mapPool(sources, concurrency, async (src) => {
        try {
          return { src, ...(await src.load(ctx)) };
        } catch (err) {
          if (ctx.signal.aborted) throw err;
          ctx.log(`${src.county} (${src.kind}) failed: ${err instanceof Error ? err.message : String(err)} — counted as not reporting`);
          return null;
        }
      });
      const rollup = new CountyRollup("MI");
      const covered: string[] = [];
      for (const r of results) {
        if (!r) continue;
        const fips = countyFipsRef("MI", r.src.county);
        if (!fips) {
          ctx.log(`no FIPS for county "${r.src.county}"; skipped`);
          continue;
        }
        covered.push(r.src.county);
        const name = `${r.src.county} County`;
        for (const c of r.contests) {
          const resolved = classifyMiContest(c.name);
          if (!resolved) continue;
          rollup.add(resolved, { fips, name, choices: c.choices, precinctsReporting: c.precinctsReporting, precinctsTotal: c.precinctsTotal }, c.name);
        }
      }
      if (covered.length === 0) throw new Error("no Michigan county feed responded");
      const races = rollup.build(ctx, {
        source: {
          adapter: ID,
          tier: "B",
          url: `${EV_HOST}/results/public/api/elections`,
          attribution: "Michigan county clerks (county election-night feeds)",
        },
      });
      ctx.log(
        `covered ${covered.length}/${stateCountyFips("MI").length} counties: ${covered.sort().join(", ")}; ${races.length} races`,
      );
      return races;
    },
  };
}

export const miCounties = makeMiCountiesAdapter();
