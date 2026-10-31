import type { Race } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { discoverSlug } from "./enhanced-voting";
import { slugify } from "./util/names";
import { ballotRaceId, resolveContest, type ResolvedContest } from "./util/race-id";
import { fetchEvBreakdownRaces } from "./az-mi-wa-shared";

/**
 * Washington Secretary of State — statewide official results (tier A), all 39 counties.
 *
 * WA moved its results site to Enhanced Voting for 2026: `results.vote.wa.gov/results/current/` 302s to
 * `results.votewa.gov/results/public/washington`. The old `/results/{date}/export/{date}_AllState.csv`
 * files exist for past elections only (the 20261103 path 404s). Verified 2026-10-30, no auth, no bot wall:
 *
 *   200 GET https://results.votewa.gov/results/public/api/jurisdictions/washington
 *           → elections 20261103 (2026 General), 20260804 (2026 Primary), 20260428, 20260210
 *   200 GET .../api/elections/washington/20261103                       isOfficialResults: false
 *   200 GET .../api/elections/washington/20261103/ballot-items          173 contests (≈11 KB gz)
 *   200 GET .../api/elections/washington/20261103/data/ballot-item/{id} county breakdown with precinct status
 *   200 GET https://results.votewa.gov/cdn/results/washington/export-20261103.json — 842 KB staged, but the
 *           2026 primary export with precinct results is 52 MB uncompressed, so the API is used.
 *
 * WA specifics: general contest "Congressional District 1 - U.S. Representative" (primary used
 * "U.S. Representative - Congressional District 1"); parties are preferences "(Prefers Democratic Party)",
 * "(States No Party Preference)"; statewide measures "Initiative Measure No. IL26-001" (local measures sit
 * in the same list and are dropped). Precinct counts are published per county (King: 3,685).
 */

const ID = "wa-sos";
export const WA_HOST = "https://results.votewa.gov";

/**
 * Statewide measure code → `ballot:WA-<slug>`. RaceMeta uses descriptive slugs for measures it knows;
 * IL26-001 is the parents'-rights initiative (SoS ballot title: "concerns parental rights ... re-enact
 * the law as it was originally enacted by Initiative to the Legislature 2081"). Others fall back to
 * `initiative-il26-638` style ids.
 */
export const WA_MEASURE_SLUGS: Record<string, string> = {
  "IL26-001": "parental-right-to-review-education",
};

export function classifyWaContest(rawName: string, contestType: string): ResolvedContest | null {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (contestType !== "Candidate") {
    const m =
      name.match(/^(initiative|referendum)\s+measure\s+no\.?\s*([A-Z]{0,2}\d{2}-\d+|\d+)\b/i) ??
      name.match(/^(senate joint resolution|house joint resolution|engrossed\s+\w+\s+joint resolution|advisory vote)\s+(?:no\.?\s*)?(\d+)/i);
    if (!m) return null;
    const code = (m[2] as string).toUpperCase();
    const kind = (m[1] as string).toLowerCase().replace(/\s+/g, "-");
    const district = WA_MEASURE_SLUGS[code] ?? slugify(`${kind}-${code}`);
    return { id: ballotRaceId("WA", district), office: "ballot", state: "WA", district, special: false, name };
  }
  const cd = name.match(/^congressional district\s+(\d{1,2})\s*-\s*u\.?\s?s\.?\s+representative\b/i);
  const r = resolveContest(cd ? `U.S. Representative District ${cd[1]}` : name, "WA", ID);
  return r && (r.office === "house" || r.office === "senate" || r.office === "governor") ? r : null;
}

export interface WaSosConfig {
  host: string;
  slug?: string;
  slugEnv?: string;
  electionDate: string;
}

export function makeWaSosAdapter(cfg: WaSosConfig): Adapter {
  return {
    id: ID,
    tier: "A",
    states: ["WA"],
    cadenceSec: 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const slug =
        (cfg.slugEnv ? process.env[cfg.slugEnv] : undefined) ??
        cfg.slug ??
        (await discoverSlug(ctx, cfg.host, "washington", cfg.electionDate));
      if (!slug) throw new Error(`no Washington EV election for ${cfg.electionDate}`);
      const { races, counties, contests } = await fetchEvBreakdownRaces(ctx, {
        host: cfg.host,
        jurisdiction: "washington",
        slug,
        state: "WA",
        classify: classifyWaContest,
        source: { adapter: ID, tier: "A", attribution: "Washington Secretary of State (county auditors' returns)" },
      });
      ctx.log(`${slug}: ${races.length} races from ${contests} contests; ${counties.length}/39 counties in feed`);
      return races;
    },
  };
}

export const waSos = makeWaSosAdapter({
  host: WA_HOST,
  slug: "20261103",
  slugEnv: "WA_ELECTION_SLUG",
  electionDate: "2026-11-03",
});
