import type { Metadata } from "next";
import { loadSources, type SourceRef } from "@/data/reference/load";
import { HEXMAP_ATTRIBUTION } from "@/components/maps/hex-cartogram";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Sources & licenses",
  description: "Every data source behind the Big Board's polls, ratings, election history and live results, with licenses and refresh schedules.",
  path: "/sources",
});

export default function SourcesPage() {
  const sources: SourceRef[] = loadSources();
  return (
    <article className="max-w-5xl space-y-6">
      <header>
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">Sources &amp; licenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The Big Board pulls live vote counts straight from official election authorities. We scrape no news
          organization&apos;s results page and republish no AP or network race calls. Every other source is listed below.
        </p>
      </header>

      <section>
        <h2 className="text-sm text-muted-foreground mb-2">Live results feeds</h2>
        <ul className="text-sm space-y-1">
          <li>North Carolina State Board of Elections: er.ncsbe.gov (statewide JSON, vote-method split)</li>
          <li>Virginia Department of Elections: enr.elections.virginia.gov (Enhanced Voting export)</li>
          <li>Georgia Secretary of State: results.sos.ga.gov (Enhanced Voting export)</li>
          <li>California Secretary of State: api.sos.ca.gov</li>
          <li>Minnesota Secretary of State: electionresultsfiles.sos.mn.gov (precinct file)</li>
          <li>Alaska Division of Elections: elections.alaska.gov (precinct CSV)</li>
          <li>Iowa Secretary of State: electionresults.iowa.gov (Clarity)</li>
          <li>County election offices (Tier B) where the state site is not machine-readable; each state board lists them</li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm text-muted-foreground mb-2">Reference data</h2>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Used for</th>
                <th className="px-3 py-2">License</th>
                <th className="px-3 py-2">Refresh</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2">
                    <a href={s.url} className="underline-offset-2 hover:underline" rel="noreferrer">
                      {s.name}
                    </a>
                    {s.attribution && <div className="text-xs text-muted-foreground">{s.attribution}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.usedFor.join(", ")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.license || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.cadence || "—"}</td>
                </tr>
              ))}
              <tr className="border-t border-border/60 align-top">
                <td className="px-3 py-2">
                  <a href="https://dkel.ec/map" rel="noreferrer" className="underline-offset-2 hover:underline">
                    Daily Kos Elections / The Downballot hexmap v3.2
                  </a>
                  <div className="text-xs text-muted-foreground">{HEXMAP_ATTRIBUTION}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">House cartogram geometry</td>
                <td className="px-3 py-2 text-muted-foreground">CC BY 4.0</td>
                <td className="px-3 py-2 text-muted-foreground">build</td>
              </tr>
              <tr className="border-t border-border/60 align-top">
                <td className="px-3 py-2">
                  U.S. Census Bureau TIGER/Line 2026 (cd120) &amp; cartographic boundaries; us-atlas 3.0.1
                </td>
                <td className="px-3 py-2 text-muted-foreground">District and county geometry (Missouri uses 119th-Congress lines)</td>
                <td className="px-3 py-2 text-muted-foreground">Public domain / ISC</td>
                <td className="px-3 py-2 text-muted-foreground">build</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="text-xs text-muted-foreground space-y-2">
        <p>
          Wikipedia-derived candidate lists and race ratings are CC BY-SA 4.0; our derived tables of those fields are
          available under the same license. Vote counts are facts published by public authorities. The Big Board itself
          republishes no proprietary polling or ratings text; Cook, Inside Elections and Sabato ratings are shown as
          categorical labels with links to the publishers.
        </p>
      </section>
    </article>
  );
}
