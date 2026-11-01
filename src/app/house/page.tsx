import type { Metadata } from "next";
import { Suspense } from "react";
import { loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import { HouseBoard } from "@/components/house/house-board";
import type { GenericBallotData } from "@/components/house/generic-ballot";
import { nationalCopy } from "@/components/board/page-copy";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "2026 House Races: Ratings, Toss-ups and Live Results",
  description: nationalCopy(loadRaces()).house,
  path: "/house",
});

export default function HousePage() {
  const metas = loadRaces().filter((r) => r.office === "house");
  const states = loadStates();
  const generic = loadPolls().generic as GenericBallotData | undefined;

  return (
    <div className="space-y-12">
      <header className="page-header">
        <h1 className="page-title">U.S. House</h1>
        <p className="page-lede">All 435 seats, with the consensus rating, live count and Big Board projection for every district.</p>
      </header>
      <Suspense>
        <HouseBoard metas={metas} states={states} generic={generic} />
      </Suspense>
    </div>
  );
}
