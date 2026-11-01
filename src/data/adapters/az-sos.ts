import type { Race } from "../schema";
import type { Adapter, AdapterCtx } from "./types";
import { discoverSlug } from "./enhanced-voting";
import { ballotRaceId, resolveContest, type ResolvedContest } from "./util/race-id";
import { fetchEvBreakdownRaces } from "./az-mi-wa-shared";

/**
 * Arizona Secretary of State — statewide official results (tier A), all 15 counties.
 *
 * The SoS results site (results.arizona.vote) is an Enhanced Voting instance behind a Cloudflare
 * challenge (403 to non-browsers); this adapter does not try to pass it. The same public EV API is
 * served without a challenge from the vendor host app.enhancedvoting.com (the host the county EV
 * exports also use). Verified 2026-10-30, all 200:
 *
 *   GET {EV}/results/public/api/jurisdictions/arizona
 *       → elections: 110326GeneralElection (2026-11-03), Primary-07-21-26
 *   GET {EV}/results/public/api/elections/Arizona/110326GeneralElection              isOfficialResults: false
 *   GET {EV}/results/public/api/elections/Arizona/110326GeneralElection/ballot-items  99 contests (≈11 KB gz)
 *   GET {EV}/results/public/api/elections/Arizona/110326GeneralElection/data/ballot-item/{id}
 *       → ballotItemWithBreakdown.breakdownResults: 15 counties (≈25 KB gz each)
 *   GET {EV}/cdn/results/Arizona/export-110326GeneralElection.json — 71 MB uncompressed even staged; not used.
 *
 * Contests: "Governor and Lieutenant Governor", "U.S. Representative in Congress - District No. 1",
 * "PROPOSITION 141" (8 statewide props). Tickets: "Katie Hobbs (DEM) / John Giles (PND)". Vote groups:
 * Election Day, Early Voting, Provisional, "Early A.R.S. 16-579", "Late Early*".
 *
 * The statewide instance is fed by county uploads and can be partial (the 2026 primary instance
 * carried only Coconino and Mohave): totals are the county sum and missing counties are padded.
 */

export const AZ_EV_HOST = "https://app.enhancedvoting.com";
const ID = "az-sos";

/** AZ contest name → race identity (Governor, US House, statewide propositions); null otherwise. */
export function classifyAzContest(rawName: string): ResolvedContest | null {
  // contestType is not used: the 2026 primary instance labels every contest "BallotMeasure".
  const name = rawName.replace(/\s+/g, " ").trim();
  const prop = name.match(/^proposition\s+(\d{3})\b/i);
  if (prop) {
    const district = `prop-${prop[1]}`;
    return { id: ballotRaceId("AZ", district), office: "ballot", state: "AZ", district, special: false, name: `Proposition ${prop[1]}` };
  }
  // Judicial retention ("Shall JOHN LOPEZ IV ... be retained in office?") and local measures never resolve here.
  const r = resolveContest(name, "AZ", ID);
  return r && (r.office === "governor" || r.office === "house" || r.office === "senate") ? r : null;
}

export interface AzSosConfig {
  jurisdiction: string;
  slug?: string;
  slugEnv?: string;
  electionDate: string;
}

export function makeAzSosAdapter(cfg: AzSosConfig): Adapter {
  return {
    id: ID,
    tier: "A",
    states: ["AZ"],
    cadenceSec: 60,
    async fetch(ctx: AdapterCtx): Promise<Race[]> {
      const slug =
        (cfg.slugEnv ? process.env[cfg.slugEnv] : undefined) ||
        cfg.slug ||
        (await discoverSlug(ctx, AZ_EV_HOST, cfg.jurisdiction.toLowerCase(), cfg.electionDate));
      if (!slug) throw new Error(`no Arizona EV election for ${cfg.electionDate}`);
      const { races, counties, contests } = await fetchEvBreakdownRaces(ctx, {
        host: AZ_EV_HOST,
        jurisdiction: cfg.jurisdiction,
        slug,
        state: "AZ",
        classify: classifyAzContest,
        source: { adapter: ID, tier: "A", attribution: "Arizona Secretary of State (county canvass uploads)" },
      });
      ctx.log(`${slug}: ${races.length} races from ${contests} contests; counties in feed (${counties.length}/15): ${counties.join(", ") || "none"}`);
      return races;
    },
  };
}

export const azSos = makeAzSosAdapter({
  jurisdiction: "Arizona",
  slug: "110326GeneralElection",
  slugEnv: "AZ_ELECTION_SLUG",
  electionDate: "2026-11-03",
});
