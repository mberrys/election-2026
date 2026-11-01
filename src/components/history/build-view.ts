import { districtRows, nationRow, stateRows, type BuildInput, type HistoryRowModel } from "@/analytics/history";
import { loadHistory, loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import { buildFlashback, type FlashbackData } from "./flashback-data";

export interface HistoryView {
  nation: HistoryRowModel;
  rowsets: Record<string, HistoryRowModel[]>;
  flashback: FlashbackData;
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

const round3 = (x: number | undefined) => (x === undefined ? undefined : Math.round(x * 1000) / 1000);

/** Only what the reference table reads (strip, projection, last time, sort keys): about a third less to ship. */
function leanRow(r: HistoryRowModel): HistoryRowModel {
  return {
    id: r.id,
    label: r.label,
    kind: r.kind,
    series: r.series,
    projection: r.projection && { margin: round3(r.projection.margin)!, source: r.projection.source },
    lastTime: r.lastTime,
    change: round3(r.change),
    caveat: r.caveat,
  };
}

/** Everything the Flashback page needs, computed once at build time. */
export function buildHistoryView(): HistoryView {
  const input = buildInput();
  const nation = nationRow(input);
  const statesPres = stateRows(input, "pres");
  const asOf = genericBallot().asOf;
  return {
    nation: leanRow(nation),
    rowsets: {
      "states:pres": statesPres.map(leanRow),
      "states:senate": stateRows(input, "senate").map(leanRow),
      "states:governor": stateRows(input, "governor").map(leanRow),
      "districts:house": districtRows(input, "house").map(leanRow),
      "districts:pres": districtRows(input, "pres").map(leanRow),
    },
    flashback: buildFlashback(nation, statesPres, input.history.years, asOf),
    asOf,
  };
}
