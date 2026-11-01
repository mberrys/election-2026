import type { Metadata } from "next";
import { GovernorsBoard } from "@/components/governors/governors-board";
import { nationalCopy } from "@/components/board/page-copy";
import { candidatePhotoMap } from "@/data/reference/images";
import { loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";
import { RatingsStrip } from "@/components/charts/ratings-strip";

export const metadata: Metadata = pageMetadata({
  title: "2026 Governor Races: Ratings, Polls and Results",
  description: nationalCopy(loadRaces()).governors,
  path: "/governors",
});

export default function GovernorsPage() {
  const metas = loadRaces().filter((r) => r.office === "governor");
  const states = loadStates().map(({ abbr, name }) => ({ abbr, name }));
  const photos = candidatePhotoMap(metas.flatMap((m) => m.candidates.map((c) => c.id)));
  return <GovernorsBoard metas={metas} states={states} photos={photos} ratings={<RatingsStrip races={metas} title="Governor races by rating" />} />;
}
