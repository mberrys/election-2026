import type { Metadata } from "next";
import { SenateBoard } from "@/components/senate/senate-board";
import { nationalCopy } from "@/components/board/page-copy";
import { candidatePhotoMap } from "@/data/reference/images";
import { loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";
import { RatingsStrip } from "@/components/charts/ratings-strip";

export const metadata: Metadata = pageMetadata({
  title: "2026 Senate Races: Ratings, Polls and Path to a Majority",
  description: nationalCopy(loadRaces()).senate,
  path: "/senate",
});

export default function SenatePage() {
  const metas = loadRaces().filter((r) => r.office === "senate");
  const states = loadStates().map(({ abbr, name }) => ({ abbr, name }));
  const photos = candidatePhotoMap(metas.flatMap((m) => m.candidates.map((c) => c.id)));
  return <SenateBoard metas={metas} states={states} photos={photos} ratings={<RatingsStrip races={metas} title="Senate races by rating" />} />;
}
