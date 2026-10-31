import { NationalBoard } from "@/components/board/national-board";
import { loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import type { RaceMeta } from "@/data/schema";

export const ensureStatic = "navigation";

/** The national board only needs identity, candidates, ratings and holder — drop polls/money/baselines/notes. */
function slim(m: RaceMeta): RaceMeta {
  return {
    id: m.id,
    office: m.office,
    state: m.state,
    district: m.district,
    special: m.special,
    name: m.name,
    candidates: m.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party, incumbent: c.incumbent, aliases: [] })),
    ratings: { consensus: m.ratings.consensus },
    baseline: {},
    heldBy: m.heldBy,
    runoffRule: m.runoffRule,
  };
}

export default function Page() {
  const races = loadRaces()
    .filter((m) => m.office === "senate" || m.office === "house" || m.office === "governor")
    .map(slim);
  const states = loadStates();
  const polls = loadPolls();
  return <NationalBoard metas={races} states={states} polls={{ ...polls, races: {} }} />;
}
