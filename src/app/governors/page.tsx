import type { Metadata } from "next";
import { GovernorsBoard } from "@/components/governors/governors-board";
import { nationalCopy } from "@/components/board/page-copy";
import { loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "2026 Governor Races: Ratings, Polls and Results",
  description: nationalCopy(loadRaces()).governors,
  path: "/governors",
});

export default function GovernorsPage() {
  const metas = loadRaces().filter((r) => r.office === "governor");
  const states = loadStates().map(({ abbr, name }) => ({ abbr, name }));
  return <GovernorsBoard metas={metas} states={states} />;
}
