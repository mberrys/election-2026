import type { Metadata } from "next";
import { GovernorsBoard } from "@/components/governors/governors-board";
import { loadRaces, loadStates } from "@/data/reference/load";

export const metadata: Metadata = {
  title: "Governors",
  description: "All 36 governor races of 2026: ratings, polls, money, live margins and projections, with flips tracked as they happen.",
};

export default function GovernorsPage() {
  const metas = loadRaces().filter((r) => r.office === "governor");
  const states = loadStates().map(({ abbr, name, tier }) => ({ abbr, name, tier }));
  return <GovernorsBoard metas={metas} states={states} />;
}
