import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StateBoard } from "@/components/state/state-board";
import { StateHistoryPanel } from "@/components/history/state-history-panel";
import { getRacesByState, getState, loadCounties, loadStates } from "@/data/reference/load";

/**
 * Blocking route (Next 16.4 "instant-shell-url-data"): the page must await `params` before it can decide between
 * a real 404 and the board, so it opts out of the instant static shell. All 51 states are still prerendered below.
 */
export const instant = false;

export function generateStaticParams() {
  return loadStates().map((s) => ({ st: s.abbr }));
}

export async function generateMetadata({ params }: PageProps<"/state/[st]">): Promise<Metadata> {
  const { st } = await params;
  const state = getState(st);
  return {
    title: state ? state.name : "State not found",
    description: state
      ? `${state.name} 2026 midterm results: county map, expected vote, benchmarks and the Big Board projection model.`
      : undefined,
  };
}

export default async function StatePage({ params }: PageProps<"/state/[st]">) {
  const { st } = await params;
  const state = getState(st);
  if (!state) notFound();

  const metas = getRacesByState().get(state.abbr) ?? [];
  const counties = Object.fromEntries(Object.entries(loadCounties()).filter(([, c]) => c.state === state.abbr));

  return (
    <div className="space-y-6">
      <Suspense>
        <StateBoard state={state} metas={metas} counties={counties} />
      </Suspense>
      <StateHistoryPanel abbr={state.abbr} />
    </div>
  );
}
