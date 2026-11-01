import { mapSimilarity, stateRows } from "@/analytics/history";
import { buildInput, genericBallot } from "@/components/history/build-view";
import { loadRaces, loadStates } from "@/data/reference/load";
import { getLocale, TRANSLATED_LANGS, worldPath } from "@/i18n/locales";
import type { Country } from "./countries";
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

/**
 * hreflang alternates for a world page: the same page in every language. One cluster per page, so every member lists
 * the same set (hreflang must be reciprocal):
 *   hub:      en    -> /world,       es -> /es/world,      ... x-default -> /world
 *   country:  en-GB -> /world/uk,    es -> /es/world/uk,   ... x-default -> /world/uk
 * The English member of a country page keeps that country's region tag (en-GB, en-AU) because it is written for readers
 * there; the translated members use the plain language tag. Different countries are different pages, not alternates of
 * each other, so they are not listed in each other's clusters.
 */
export function worldAlternates(country?: Country): Record<string, string> {
  const rest = country ? `/${country.slug}` : "";
  const english = worldPath("en", rest);
  return {
    [country?.locale ?? "en"]: english,
    ...Object.fromEntries(TRANSLATED_LANGS.map((lang) => [getLocale(lang).tag, worldPath(lang, rest)])),
    "x-default": english,
  };
}
