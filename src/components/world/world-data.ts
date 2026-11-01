import { mapSimilarity, stateRows } from "@/analytics/history";
import { buildInput, genericBallot } from "@/components/history/build-view";
import { loadRaces, loadStates } from "@/data/reference/load";
import { COUNTRIES } from "./countries";
import { catchUp, closingWaves, finalClose } from "./world-content";

/** Everything the /world pages render, computed once per build from the reference data. */
export function worldData() {
  const races = loadRaces();
  const input = buildInput();
  const states = stateRows(input, "pres");
  const projected: Record<string, number> = {};
  for (const r of states) if (r.projection) projected[r.id] = r.projection.margin;
  const best = mapSimilarity(projected, Object.fromEntries(states.map((r) => [r.id, r.series])), input.history.years)[0];
  const lookalike = best ? { year: best.year, meanGap: Math.round(best.meanGap * 10) / 10 } : undefined;
  return {
    waves: closingWaves(loadStates(), races),
    final: finalClose(loadStates()),
    catchUp: catchUp(races, genericBallot(), lookalike),
  };
}

/** hreflang alternates: one English variant per country, the hub as the default. */
export function worldLanguages(): Record<string, string> {
  return { ...Object.fromEntries(COUNTRIES.map((c) => [c.locale, `/world/${c.slug}`])), "x-default": "/world" };
}
