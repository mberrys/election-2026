import { districtRows, nationRow, stateRows, type BuildInput, type HistoryRowModel } from "@/analytics/history";
import { loadHistory, loadPolls, loadRaces, loadStates } from "@/data/reference/load";

export interface HistoryView {
  nation: HistoryRowModel;
  rowsets: Record<string, HistoryRowModel[]>;
  trend: NonNullable<ReturnType<typeof loadPolls>["trend"]>;
  asOf?: string;
}

/** Generic-ballot margin and date: the five-average when available, else VoteHub's two-week mean. */
export function genericBallot(): { margin?: number; asOf?: string } {
  const g = loadPolls().generic;
  if (g.riotimes) return { margin: g.riotimes.margin, asOf: g.riotimes.asOf };
  if (g.votehub) return { margin: Math.round((g.votehub.d - g.votehub.r) * 10) / 10, asOf: g.votehub.asOf };
  return {};
}

export function buildInput(): BuildInput {
  const g = genericBallot();
  return {
    history: loadHistory(),
    races: loadRaces(),
    stateNames: Object.fromEntries(loadStates().map((s) => [s.abbr, s.name])),
    genericMargin: g.margin,
  };
}

/** Everything the Then & Now page needs, computed once at build time. */
export function buildHistoryView(): HistoryView {
  const input = buildInput();
  return {
    nation: nationRow(input),
    rowsets: {
      "states:pres": stateRows(input, "pres"),
      "states:senate": stateRows(input, "senate"),
      "states:governor": stateRows(input, "governor"),
      "districts:house": districtRows(input, "house"),
      "districts:pres": districtRows(input, "pres"),
    },
    trend: loadPolls().trend ?? {},
    asOf: genericBallot().asOf,
  };
}
