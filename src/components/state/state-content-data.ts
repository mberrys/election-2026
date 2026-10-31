import { buildInput } from "@/components/history/build-view";
import { stateRows } from "@/analytics/history";
import { getRacesByState, getState, loadHistory } from "@/data/reference/load";
import type { StateContentInput } from "./state-content";

/** Loads everything the state page text, metadata and share image are built from. */
export function stateContentInput(abbr: string): StateContentInput | undefined {
  const state = getState(abbr);
  if (!state) return undefined;
  return {
    state,
    races: getRacesByState().get(state.abbr) ?? [],
    history: loadHistory().states[state.abbr],
    row: stateRows(buildInput(), "pres").find((r) => r.id === state.abbr),
  };
}
