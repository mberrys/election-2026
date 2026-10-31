import type { Metadata } from "next";
import { HistoryBoard } from "@/components/history/history-board";
import { buildHistoryView } from "@/components/history/build-view";
import { JsonLd } from "@/components/seo/json-ld";
import { loadHistory } from "@/data/reference/load";
import { historyDatasetJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Then & Now",
  alternates: { canonical: "/history" },
  description: "Current polling against every presidential election since 1976, and the last time each state or district voted the way the polls point.",
};

export default function HistoryPage() {
  const view = buildHistoryView();
  const { years, builtAt } = loadHistory();
  return (
    <div className="space-y-4">
      <JsonLd data={historyDatasetJsonLd({ firstYear: years[0], lastYear: years[years.length - 1], dateModified: builtAt })} />
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">Then &amp; Now</h1>
        <p className="text-sm text-muted-foreground">Where the polls point, and the last time each place voted that way</p>
      </header>
      <HistoryBoard nation={view.nation} rowsets={view.rowsets} trend={view.trend} asOf={view.asOf} />
    </div>
  );
}
