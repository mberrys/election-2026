import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StateBoard } from "@/components/state/state-board";
import { StateHistoryPanel } from "@/components/history/state-history-panel";
import { StateQa } from "@/components/state/state-qa";
import { stateDescription, stateTitle } from "@/components/state/state-content";
import { stateContentInput } from "@/components/state/state-content-data";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo";
import { getRacesByState, getState, loadCounties, loadPolls, loadStates } from "@/data/reference/load";

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
  const input = stateContentInput(st);
  if (!input) return { title: "State not found" };
  return pageMetadata({ title: stateTitle(input.state.name), description: stateDescription(input), path: `/state/${input.state.abbr}` });
}

export default async function StatePage({ params }: PageProps<"/state/[st]">) {
  const { st } = await params;
  const state = getState(st);
  const input = stateContentInput(st);
  if (!state || !input) notFound();

  const metas = getRacesByState().get(state.abbr) ?? [];
  const counties = Object.fromEntries(Object.entries(loadCounties()).filter(([, c]) => c.state === state.abbr));
  const path = `/state/${state.abbr}`;

  return (
    <div className="space-y-6">
      <JsonLd
        data={webPageJsonLd({
          name: stateTitle(state.name),
          description: stateDescription(input),
          path,
          dateModified: loadPolls().builtAt,
          about: { type: "State", name: state.name },
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "States & Measures", path: "/states" },
          { name: state.name, path },
        ])}
      />
      <Suspense>
        <StateBoard state={state} metas={metas} counties={counties} />
      </Suspense>
      <StateHistoryPanel abbr={state.abbr} />
      <StateQa input={input} />
    </div>
  );
}
