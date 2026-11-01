import { raceRow } from "@/analytics/history";
import { buildInput } from "@/components/history/build-view";
import { getRace, getState, loadHistory, loadRaces } from "@/data/reference/load";
import { isRaceOffice, raceSlug, type RaceContentInput } from "./race-content";

let bySlug: Map<string, string> | undefined;

/** Every race that gets its own page: Senate (regular and special), governor and House. Ballot measures and state legislative races do not. */
export function racePageSlugs(): string[] {
  return loadRaces()
    .filter((r) => isRaceOffice(r.office))
    .map(raceSlug);
}

function raceIdForSlug(slug: string): string | undefined {
  if (!bySlug) bySlug = new Map(loadRaces().map((r) => [raceSlug(r), r.id]));
  return bySlug.get(slug);
}

/** Loads everything a race page's text, metadata and share image are built from. */
export function raceContentInput(slug: string): RaceContentInput | undefined {
  const id = raceIdForSlug(slug);
  const meta = id ? getRace(id) : undefined;
  if (!meta || !isRaceOffice(meta.office)) return undefined;
  const state = getState(meta.state);
  if (!state) return undefined;

  const history = loadHistory();
  const stateHistory = history.states[meta.state];
  const district = meta.office === "house" ? history.districts[`${meta.state}-${meta.district}`] : undefined;

  // Statewide races use their own office's history; House races use the district's presidential margins on 2026 lines.
  let row: RaceContentInput["row"];
  if (meta.office === "house") {
    if (district && Object.keys(district.pres).length) row = raceRow(meta, district.pres, district.pres["2024"], buildInput(), meta.name);
  } else if (stateHistory) {
    const series = stateHistory[meta.office];
    if (Object.keys(series).length) row = raceRow(meta, series, stateHistory.pres["2024"], buildInput(), state.name);
  }
  return { meta, state, stateHistory, district, row };
}
