import type { CandidateResult, Party, Race, RaceMeta, ReportingUnit, Tier, VoteModes } from "../schema";
import { loadCounties } from "../reference/load";
import type { AdapterCtx } from "./types";
import { modesFromGroups } from "./enhanced-voting";
import { getJson, mapPool, tryJson } from "./util/http";
import { normalizeParty } from "./util/party";
import { matchCandidates, slugify, type FeedCandidate } from "./util/names";
import type { ResolvedContest } from "./util/race-id";
import { addModes, assembleRace, makeUnit } from "./util/race";

/**
 * Shared county roll-up for the AZ / MI / WA adapters (az-sos, mi-counties, wa-sos).
 *
 * All three feeds end up as "one contest result per county": AZ and WA from a statewide
 * Enhanced Voting instance's county breakdown, MI from separate county feeds. `CountyRollup`
 * collects those per-county results and builds statewide `Race`s whose totals are the SUM OF
 * THE COUNTIES ACTUALLY PRESENT. Every county the race should have but the feed lacks is added
 * as a zero-vote unit with `precinctsReporting: 0` (never `complete`), so expected-vote math
 * keeps it outstanding. House races use the district→county crosswalk below; statewide races
 * use every county of the state from the reference layer.
 *
 * `util/fips.ts` has no AZ/MI/WA tables, so county FIPS come from
 * public/data/reference/counties.json (same source the analytics baselines use).
 */

// ---------- county FIPS ----------

const fipsByState = new Map<string, Map<string, string>>();

function normCounty(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bcounty\b/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stateTable(state: string): Map<string, string> {
  const st = state.toUpperCase();
  let m = fipsByState.get(st);
  if (!m) {
    m = new Map();
    for (const [fips, c] of Object.entries(loadCounties())) if (c.state === st) m.set(normCounty(c.name), fips);
    fipsByState.set(st, m);
  }
  return m;
}

/** "St. Clair County" / "ST CLAIR" / "Grays Harbor" → 5-digit FIPS. */
export function countyFipsRef(state: string, name: string): string | undefined {
  return stateTable(state).get(normCounty(name));
}

/** Every county FIPS of a state, sorted. */
export function stateCountyFips(state: string): string[] {
  return [...stateTable(state).values()].sort();
}

export function countyDisplayName(fips: string): string {
  return loadCounties()[fips]?.name ?? fips;
}

/**
 * 119th/120th-Congress district → counties. Generated 2026-10-30 from the repo's own geometry
 * (public/data/geo/districts-2026.json × counties-10m.json, planar polygon intersection):
 * a county is listed when the overlap is ≥5 % of the county's area or ≥5 % of the district's
 * area, which drops simplification slivers. Used only to pad House races with counties a feed
 * is missing; counties present in a feed always contribute what they report.
 */
export const HOUSE_COUNTIES: Record<string, string[]> = {
  "house:AZ-01": ["04013"],
  "house:AZ-02": ["04001", "04005", "04007", "04009", "04015", "04017", "04021", "04025"],
  "house:AZ-03": ["04013"],
  "house:AZ-04": ["04013"],
  "house:AZ-05": ["04013", "04021"],
  "house:AZ-06": ["04003", "04009", "04011", "04019", "04021"],
  "house:AZ-07": ["04003", "04013", "04019", "04021", "04023", "04027"],
  "house:AZ-08": ["04013"],
  "house:AZ-09": ["04012", "04013", "04015", "04027"],
  "house:MI-01": [
    "26001", "26003", "26007", "26009", "26011", "26013", "26019", "26029", "26031", "26033", "26039", "26041",
    "26043", "26047", "26053", "26055", "26061", "26069", "26071", "26079", "26083", "26089", "26095", "26097",
    "26103", "26109", "26113", "26119", "26129", "26131", "26135", "26137", "26141", "26143", "26153", "26165",
  ],
  "house:MI-02": [
    "26015", "26035", "26045", "26051", "26057", "26067", "26073", "26081", "26085", "26101", "26105", "26107",
    "26111", "26117", "26121", "26123", "26127", "26133", "26139", "26165",
  ],
  "house:MI-03": ["26081", "26121", "26139"],
  "house:MI-04": ["26005", "26021", "26025", "26077", "26139", "26159"],
  "house:MI-05": ["26021", "26023", "26025", "26027", "26059", "26075", "26077", "26091", "26115", "26149"],
  "house:MI-06": ["26161", "26163"],
  "house:MI-07": ["26037", "26045", "26065", "26093", "26125", "26155"],
  "house:MI-08": ["26017", "26049", "26111", "26145"],
  "house:MI-09": ["26063", "26087", "26099", "26125", "26147", "26151", "26157"],
  "house:MI-10": ["26099", "26125"],
  "house:MI-11": ["26125"],
  "house:MI-12": ["26125", "26163"],
  "house:MI-13": ["26163"],
  "house:WA-01": ["53033", "53061"],
  "house:WA-02": ["53029", "53055", "53057", "53061", "53073"],
  "house:WA-03": ["53011", "53015", "53041", "53049", "53059", "53067", "53069"],
  "house:WA-04": ["53001", "53005", "53017", "53021", "53025", "53039", "53047", "53077"],
  "house:WA-05": ["53001", "53003", "53013", "53019", "53021", "53023", "53043", "53051", "53063", "53065", "53071", "53075"],
  "house:WA-06": ["53009", "53027", "53031", "53035", "53045", "53053"],
  "house:WA-07": ["53033"],
  "house:WA-08": ["53007", "53033", "53037", "53053", "53061"],
  "house:WA-09": ["53033"],
  "house:WA-10": ["53053", "53067"],
};

/** Counties a race is expected to span: crosswalk for House, whole state otherwise. */
export function expectedCounties(raceId: string, state: string): string[] {
  return HOUSE_COUNTIES[raceId] ?? stateCountyFips(state);
}

// ---------- Enhanced Voting public API helpers ----------

/** EV API localized text: `[{ languageId: "en", text }]`. */
export type EvText = { languageId: string | null; text: string }[];
export function enText(t: EvText | null | undefined): string {
  if (!t || t.length === 0) return "";
  return (t.find((x) => x.languageId === "en") ?? t[0])?.text?.trim() ?? "";
}

export interface EvApiOption {
  id: string;
  name: EvText;
  voteCount: number | null;
  party: { name: EvText | null; abbreviation: string | null } | null;
  groupResults: { groupName: EvText; voteCount: number | null }[] | null;
  isWriteIn?: boolean;
}

/** Map a vote-method group label to the wording `modesFromGroups` understands. */
export function normalizeGroupName(name: string): string {
  // MI: "AV Counting Boards" = absentee ballots tabulated centrally.
  if (/^\s*av\b|counting board/i.test(name)) return `Absentee (${name})`;
  return name;
}

export function groupModes(groups: { groupName: string; voteCount: number | null }[] | null | undefined): VoteModes | undefined {
  if (!groups || groups.length === 0) return undefined;
  return modesFromGroups(groups.map((g) => ({ groupName: normalizeGroupName(g.groupName), voteCount: g.voteCount })));
}

/** EV API ballot options → county choices (rejected write-ins are not votes and are dropped). */
export function choicesFromEvApi(options: EvApiOption[]): CountyChoice[] {
  const out: CountyChoice[] = [];
  for (const o of options) {
    // St. Clair publishes its write-in row with a null name.
    const name = enText(o.name) || (o.isWriteIn !== false ? "Write-in" : "");
    if (!name || /rejected/i.test(name)) continue;
    const modes = groupModes((o.groupResults ?? []).map((g) => ({ groupName: enText(g.groupName), voteCount: g.voteCount })));
    out.push({
      name,
      party: normalizeParty(enText(o.party?.name) || o.party?.abbreviation || null),
      votes: o.voteCount ?? 0,
      ...(modes ? { modes } : {}),
    });
  }
  return out;
}

// ---------- roll-up ----------

export interface CountyChoice {
  name: string;
  party: Party;
  votes: number;
  modes?: VoteModes;
}

export interface CountyContest {
  fips: string;
  /** Display name, e.g. "Kent County". */
  name: string;
  choices: CountyChoice[];
  precinctsReporting?: number;
  precinctsTotal?: number;
}

export interface RollupSource {
  adapter: string;
  tier: Tier;
  url?: string;
  attribution: string;
}

export interface RollupOptions {
  source: RollupSource;
  certified?: boolean;
  /** Display name for ballot measures (feed name when absent from metas). */
  ballotName?: (id: string, feedName: string) => string;
}

interface Entry {
  resolved: ResolvedContest;
  feedName: string;
  counties: Map<string, CountyContest>;
}

export class CountyRollup {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly state: string) {}

  /** Add one county's result for a contest. A second result for the same county+race is summed. */
  add(resolved: ResolvedContest, county: CountyContest, feedName = resolved.name): void {
    let e = this.entries.get(resolved.id);
    if (!e) {
      e = { resolved, feedName, counties: new Map() };
      this.entries.set(resolved.id, e);
    }
    const prev = e.counties.get(county.fips);
    if (!prev) {
      e.counties.set(county.fips, { ...county, choices: county.choices.map((c) => ({ ...c })) });
      return;
    }
    for (const c of county.choices) {
      const hit = prev.choices.find((p) => p.name === c.name);
      if (hit) {
        hit.votes += c.votes;
        hit.modes = addModes(hit.modes, c.modes);
      } else prev.choices.push({ ...c });
    }
    if (county.precinctsReporting !== undefined) prev.precinctsReporting = (prev.precinctsReporting ?? 0) + county.precinctsReporting;
    if (county.precinctsTotal !== undefined) prev.precinctsTotal = (prev.precinctsTotal ?? 0) + county.precinctsTotal;
  }

  get size(): number {
    return this.entries.size;
  }

  build(ctx: Pick<AdapterCtx, "now" | "metas" | "log">, opts: RollupOptions): Race[] {
    const races: Race[] = [];
    for (const e of this.entries.values()) races.push(this.buildOne(e, ctx, opts));
    return races;
  }

  private buildOne(e: Entry, ctx: Pick<AdapterCtx, "now" | "metas" | "log">, opts: RollupOptions): Race {
    const { resolved } = e;
    const meta = ctx.metas.get(resolved.id);
    const isBallot = resolved.office === "ballot";

    // Candidates: match each county's list against RaceMeta (ids stay stable across counties), then sum.
    const totals = new Map<string, CandidateResult>();
    const units: ReportingUnit[] = [];
    let modes: VoteModes | undefined;
    let pr = 0;
    let pt = 0;
    let precinctsKnown = true;
    for (const county of e.counties.values()) {
      const feed: FeedCandidate[] = county.choices.map((c) => ({ name: c.name, party: c.party, votes: c.votes }));
      const matched: CandidateResult[] = isBallot
        ? county.choices.map((c, i) => ({ id: slugify(c.name) || `option-${i + 1}`, name: titleCase(c.name), party: "O" as const, votes: c.votes, pct: 0 }))
        : reconcileByParty(matchCandidates(feed, meta), meta);
      const votes: Record<string, number> = {};
      let umodes: VoteModes | undefined;
      matched.forEach((m, i) => {
        votes[m.id] = (votes[m.id] ?? 0) + m.votes;
        const t = totals.get(m.id);
        if (t) t.votes += m.votes;
        else totals.set(m.id, { ...m });
        umodes = addModes(umodes, county.choices[i]?.modes);
      });
      modes = addModes(modes, umodes);
      if (county.precinctsTotal !== undefined) pt += county.precinctsTotal;
      else precinctsKnown = false;
      pr += county.precinctsReporting ?? 0;
      units.push(
        makeUnit(
          {
            id: county.fips,
            name: county.name,
            fips: county.fips,
            level: "county",
            ...(county.precinctsReporting !== undefined ? { precinctsReporting: county.precinctsReporting } : {}),
            ...(county.precinctsTotal !== undefined ? { precinctsTotal: county.precinctsTotal } : {}),
            ...(umodes ? { modes: umodes } : {}),
          },
          votes,
        ),
      );
    }

    // Partial coverage: counties the race spans but no feed delivered → zero units, 0 precincts reporting.
    const expected = expectedCounties(resolved.id, this.state);
    const missing = expected.filter((f) => !e.counties.has(f));
    const zero: Record<string, number> = Object.fromEntries([...totals.keys()].map((id) => [id, 0]));
    for (const fips of missing) {
      units.push(makeUnit({ id: fips, name: countyDisplayName(fips), fips, level: "county", precinctsReporting: 0 }, { ...zero }));
    }
    units.sort((a, b) => a.id.localeCompare(b.id));

    const covered = e.counties.size;
    const partial = missing.length > 0;
    const attribution = partial
      ? `${opts.source.attribution} — partial: ${covered} of ${covered + missing.length} counties in feed; ${missing.length} counted as not reporting`
      : opts.source.attribution;

    const name = isBallot ? (meta?.name ?? opts.ballotName?.(resolved.id, e.feedName) ?? e.feedName) : resolved.name;
    return assembleRace({
      ...resolved,
      name,
      candidates: [...totals.values()],
      units,
      // Race-level precinct counts only when the whole race is covered; otherwise a covered-only
      // ratio would read as "100 % in" while whole counties are still outstanding.
      ...(!partial && precinctsKnown && pt > 0 ? { precinctsReporting: pr, precinctsTotal: pt } : {}),
      ...(partial ? { precinctsReporting: pr } : {}),
      modes,
      certified: opts.certified && !partial,
      source: { ...opts.source, attribution },
      ctx,
    });
  }
}

/**
 * Second chance for feed spellings that `matchCandidates` misses ("Timothy A. Teagan" in Oakland vs
 * RaceMeta "Timothy A. Tegan"): an unmatched non-write-in row whose party (other than "O") belongs to
 * exactly one RaceMeta candidate not already matched in this county takes that candidate's id. Keeps
 * one id per candidate across counties, which the roll-up needs to sum correctly.
 */
export function reconcileByParty(matched: CandidateResult[], meta: RaceMeta | undefined): CandidateResult[] {
  if (!meta) return matched;
  const metaIds = new Set(meta.candidates.map((c) => c.id));
  const used = new Set(matched.filter((m) => metaIds.has(m.id)).map((m) => m.id));
  return matched.map((m) => {
    if (metaIds.has(m.id) || m.id === "write-in" || m.party === "O") return m;
    const sameParty = meta.candidates.filter((c) => c.party === m.party);
    const pick = sameParty.length === 1 ? sameParty[0] : undefined;
    const others = matched.filter((x) => x !== m && x.party === m.party && !metaIds.has(x.id) && x.id !== "write-in");
    if (!pick || used.has(pick.id) || others.length > 0) return m;
    used.add(pick.id);
    return { ...m, id: pick.id, name: pick.name, ...(pick.incumbent ? { incumbent: true } : {}) };
  });
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ---------- statewide EV instance: per-contest county breakdown ----------

export interface EvBallotItemSummary {
  id: string;
  name: EvText;
  contestType: string;
}
export interface EvBreakdownResult {
  locality: { name: EvText };
  precinctReportingStatus: { reportingUnits: number | null; totalUnits: number | null } | null;
  ballotOptions: EvApiOption[];
}
export interface EvBallotItemDetail {
  ballotItemWithBreakdown: { name: EvText; breakdownResults: EvBreakdownResult[] | null } | null;
}

export interface EvBreakdownOptions {
  /** e.g. "https://app.enhancedvoting.com" */
  host: string;
  /** API path segment: "Arizona", "washington". */
  jurisdiction: string;
  slug: string;
  state: string;
  classify: (name: string, contestType: string) => ResolvedContest | null;
  source: Omit<RollupSource, "url">;
  concurrency?: number;
}

/**
 * Statewide Enhanced Voting instance read through its public API (AZ, WA):
 *   GET {host}/results/public/api/elections/{jurisdiction}/{slug}                       election meta
 *   GET {host}/results/public/api/elections/{jurisdiction}/{slug}/ballot-items          contest list (no county split)
 *   GET {host}/results/public/api/elections/{jurisdiction}/{slug}/data/ballot-item/{id} ballotItemWithBreakdown:
 *       one entry per county with options, vote groups and precinct reporting status
 * The API is gzip-compressed (≈20–40 KB per contest); the CDN export of the same instance is not
 * compressed above 8 MB and reaches 50–70 MB once precinct results fill in (WA 2026 primary: 52 MB).
 * A contest whose breakdown request fails is skipped (logged) rather than reported from the
 * statewide summary, so totals are always the sum of the counties present.
 */
export async function fetchEvBreakdownRaces(ctx: AdapterCtx, o: EvBreakdownOptions): Promise<{ races: Race[]; counties: string[]; contests: number }> {
  const base = `${o.host}/results/public/api/elections/${o.jurisdiction}/${o.slug}`;
  const [meta, list] = await Promise.all([
    tryJson<{ isOfficialResults?: boolean }>(ctx, base),
    getJson<{ data: EvBallotItemSummary[] }>(ctx, `${base}/ballot-items`),
  ]);
  const wanted = list.data
    .map((item) => ({ item, resolved: o.classify(enText(item.name), item.contestType) }))
    .filter((x): x is { item: EvBallotItemSummary; resolved: ResolvedContest } => x.resolved !== null);

  const details = await mapPool(wanted, o.concurrency ?? 3, async ({ item }) => {
    try {
      return await getJson<EvBallotItemDetail>(ctx, `${base}/data/ballot-item/${item.id}`);
    } catch (err) {
      if (ctx.signal.aborted) throw err;
      ctx.log(`breakdown failed for "${enText(item.name)}": ${err instanceof Error ? err.message : String(err)} — race skipped`);
      return null;
    }
  });

  const rollup = new CountyRollup(o.state);
  const seen = new Set<string>();
  wanted.forEach(({ item, resolved }, i) => {
    for (const b of details[i]?.ballotItemWithBreakdown?.breakdownResults ?? []) {
      const countyName = enText(b.locality.name);
      const fips = countyFipsRef(o.state, countyName);
      if (!fips) {
        ctx.log(`unknown county "${countyName}" in ${resolved.id}; skipped`);
        continue;
      }
      seen.add(countyName);
      const st = b.precinctReportingStatus;
      rollup.add(
        resolved,
        {
          fips,
          name: countyName,
          choices: choicesFromEvApi(b.ballotOptions),
          ...(st?.totalUnits ? { precinctsTotal: st.totalUnits, precinctsReporting: st.reportingUnits ?? 0 } : {}),
        },
        enText(item.name),
      );
    }
  });
  const races = rollup.build(ctx, {
    source: { ...o.source, url: `${base}/ballot-items` },
    certified: meta?.isOfficialResults === true,
  });
  return { races, counties: [...seen].sort(), contests: wanted.length };
}
