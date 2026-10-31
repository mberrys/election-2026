import type { Metadata } from "next";
import { SenateBoard } from "@/components/senate/senate-board";
import { loadRaces, loadStates } from "@/data/reference/load";

export const metadata: Metadata = {
  title: "Senate",
  alternates: { canonical: "/senate" },
  description: "Live 2026 Senate balance of power, paths to a majority, and all 35 races with ratings, polls, money and results.",
};

export default function SenatePage() {
  const metas = loadRaces().filter((r) => r.office === "senate");
  const states = loadStates().map(({ abbr, name, tier }) => ({ abbr, name, tier }));
  return <SenateBoard metas={metas} states={states} />;
}
