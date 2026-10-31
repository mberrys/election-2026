import type { Metadata } from "next";
import { Suspense } from "react";
import { loadRaces, loadStates } from "@/data/reference/load";
import { StatesBoard } from "@/components/states/states-board";

export const metadata: Metadata = { title: "States & Measures", alternates: { canonical: "/states" } };

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
