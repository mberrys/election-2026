import type { Metadata } from "next";
import { Suspense } from "react";
import { loadRaces, loadStates } from "@/data/reference/load";
import { StatesBoard } from "@/components/states/states-board";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "2026 State Ballot Measures and Legislature Races",
  description: `${loadRaces().filter((r) => r.office === "ballot").length} statewide ballot measures and ${loadRaces().filter((r) => r.office === "stateleg").length} state legislative chamber races on the Nov 3, 2026 ballot, by state, with governors and poll closing times.`,
  path: "/states",
});

export default function StatesPage() {
  const races = loadRaces();
  const legs = races.filter((r) => r.office === "stateleg");
  const measures = races.filter((r) => r.office === "ballot");
  const governors = races.filter((r) => r.office === "governor");
  const states = loadStates();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">States &amp; Measures</h1>
        <p className="text-sm text-muted-foreground">Legislative chambers and statewide ballot measures on the 2026 ballot</p>
      </header>
      <Suspense>
        <StatesBoard legs={legs} measures={measures} governors={governors} states={states} />
      </Suspense>
    </div>
  );
}
