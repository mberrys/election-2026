import type { Metadata } from "next";
import { SenateBoard } from "@/components/senate/senate-board";
import { nationalCopy } from "@/components/board/page-copy";
import { genericBallot } from "@/components/history/build-view";
import { loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "2026 Senate Races: Ratings, Polls and Path to a Majority",
  description: nationalCopy(loadRaces(), genericBallot().margin).senate,
  path: "/senate",
});

export default function SenatePage() {
  const metas = loadRaces().filter((r) => r.office === "senate");
  const states = loadStates().map(({ abbr, name, tier }) => ({ abbr, name, tier }));
  return <SenateBoard metas={metas} states={states} />;
}
