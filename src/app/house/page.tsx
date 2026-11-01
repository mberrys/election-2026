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
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">U.S. House</h1>
        <p className="text-sm text-muted-foreground">All 435 seats · 218 for a majority</p>
      </header>
      <Suspense>
        <HouseBoard metas={metas} states={states} generic={generic} />
      </Suspense>
    </div>
  );
}
