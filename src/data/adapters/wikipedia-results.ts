import type { Race } from "../schema";
import type { Adapter, AdapterCtx } from "./types";

/**
 * Tier C — Wikipedia race-article infobox results (CC BY-SA, hand-edited,
 * lags minutes to hours). Intended for states with no open official feed
 * (PA, NV, NH, WI, ME statewide).
 *
 * TODO(not implemented):
 *   1. For each configured race, fetch the article wikitext via
 *      https://en.wikipedia.org/w/api.php?action=parse&page={title}&prop=wikitext&format=json
 *      (API is curl-friendly; set a descriptive User-Agent per WMF policy).
 *   2. Parse the `{{Infobox election}}` template: `candidate1`/`party1`/`popular_vote1`/`percentage1`…
 *      and the results table (`{{Election box candidate with party link}}` rows) as a fallback.
 *   3. Map to Race with tier "C", `source.attribution = "Wikipedia (CC BY-SA 4.0)"`, no units.
 *   4. Poll at ≥ 5 min cadence; never let a Wikipedia value override a tier A/B race in merge.
 */
export const wikipediaResults: Adapter = {
  id: "wikipedia-results",
  tier: "C",
  states: ["PA", "NV", "NH", "WI", "ME"],
  cadenceSec: 300,
  async fetch(ctx: AdapterCtx): Promise<Race[]> {
    ctx.log("NotImplemented: wikipedia-results is a stub (see TODO in wikipedia-results.ts)");
    return [];
  },
};
