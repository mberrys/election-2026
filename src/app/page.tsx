import type { Metadata } from "next";
import { NationalBoard } from "@/components/board/national-board";
import { nationalCopy } from "@/components/board/page-copy";
import { JsonLd } from "@/components/seo/json-ld";
import { selectKeyRaces } from "@/components/board/key-races";
import { candidatePhotoMap } from "@/data/reference/images";
import { loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import type { RaceMeta } from "@/data/schema";
import { pageMetadata } from "@/lib/page-meta";
import { webPageJsonLd } from "@/lib/seo";
import { DEFAULT_TITLE } from "@/lib/site";

export const ensureStatic = "navigation";

const description = nationalCopy(loadRaces()).home;

export const metadata: Metadata = pageMetadata({ description, path: "/" });

/** The national board needs identity, candidates, ratings, holder and the poll average (race cards show it); drop money, baselines and notes. */
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
    ...(m.polls ? { polls: m.polls } : {}),
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
  // Faces only for the cards the board will show, not all ~1,000 candidates.
  const photos = candidatePhotoMap(selectKeyRaces(races).flatMap((m) => m.candidates.map((c) => c.id)));
  const polls = loadPolls();
  return (
    <>
      <JsonLd data={webPageJsonLd({ name: DEFAULT_TITLE, description, path: "/", dateModified: polls.builtAt })} />
      <NationalBoard metas={races} states={states} polls={{ ...polls, races: {} }} photos={photos} />
    </>
  );
}
