import type { Metadata } from "next";
import { GovernorsBoard } from "@/components/governors/governors-board";
import { nationalCopy } from "@/components/board/page-copy";
import { genericBallot } from "@/components/history/build-view";
import { loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "2026 Governor Races: Ratings, Polls and Results",
  description: nationalCopy(loadRaces(), genericBallot().margin).governors,
  path: "/governors",
});

export default function GovernorsPage() {
  const metas = loadRaces().filter((r) => r.office === "governor");
  const states = loadStates().map(({ abbr, name, tier }) => ({ abbr, name, tier }));
  return <GovernorsBoard metas={metas} states={states} />;
}
