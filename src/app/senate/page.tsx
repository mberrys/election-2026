import type { Metadata } from "next";
import { SenateBoard } from "@/components/senate/senate-board";
import { nationalCopy } from "@/components/board/page-copy";
import { loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "2026 Senate Races: Ratings, Polls and Path to a Majority",
  description: nationalCopy(loadRaces()).senate,
  path: "/senate",
});

export default function SenatePage() {
  const metas = loadRaces().filter((r) => r.office === "senate");
  const states = loadStates().map(({ abbr, name }) => ({ abbr, name }));
  return <SenateBoard metas={metas} states={states} />;
}
