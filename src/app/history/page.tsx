import type { Metadata } from "next";
import { Flashback } from "@/components/history/flashback";
import { HistoryBoard } from "@/components/history/history-board";
import { buildHistoryView } from "@/components/history/build-view";
import { JsonLd } from "@/components/seo/json-ld";
import { loadHistory } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";
import { historyDatasetJsonLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Flashback: 2026 Polls Against 50 Years of Election History",
  description:
    "Scrub through every presidential map since 1976 and see where the 2026 polls land. Find the last time your state voted this blue or this red, and which past election 2026 most resembles.",
  path: "/history",
});

export default function HistoryPage() {
  const view = buildHistoryView();
  const { years, builtAt } = loadHistory();
  return (
    <div className="space-y-16">
      <JsonLd data={historyDatasetJsonLd({ firstYear: years[0], lastYear: years[years.length - 1], dateModified: builtAt })} />
      <div className="space-y-6">
        <header className="page-header">
          <h1 className="page-title">Flashback</h1>
          <p className="page-lede">Every presidential map since {years[0]} on one slider, ending with where the 2026 polls point.</p>
        </header>
        <Flashback data={view.flashback} />
      </div>
      <HistoryBoard nation={view.nation} rowsets={view.rowsets} asOf={view.asOf} />
    </div>
  );
}
