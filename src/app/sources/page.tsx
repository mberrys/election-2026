import type { Metadata } from "next";
import { loadSources, type SourceRef } from "@/data/reference/load";
import { HEXMAP_ATTRIBUTION } from "@/components/maps/hex-cartogram";

export const metadata: Metadata = { title: "Sources & licenses" };

export default function SourcesPage() {
  const sources: SourceRef[] = loadSources();
  return (
    <article className="max-w-5xl space-y-6">
      <header>
        <h1 className="display text-3xl font-bold tracking-tight">Sources &amp; licenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything the Big Board shows comes from the sources below. Live vote counts are pulled directly from official
          election authorities; nothing is scraped from news organizations&apos; results pages, and no AP or network race
          calls are republished.
        </p>
      </header>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Live results feeds</h2>
        <ul className="text-sm space-y-1">
          <li>North Carolina State Board of Elections — er.ncsbe.gov (statewide JSON, vote-method split)</li>
          <li>Virginia Department of Elections — enr.elections.virginia.gov (Enhanced Voting export)</li>
          <li>Georgia Secretary of State — results.sos.ga.gov (Enhanced Voting export)</li>
          <li>California Secretary of State — api.sos.ca.gov</li>
          <li>Minnesota Secretary of State — electionresultsfiles.sos.mn.gov (precinct file)</li>
          <li>Alaska Division of Elections — elections.alaska.gov (precinct CSV)</li>
          <li>Iowa Secretary of State — electionresults.iowa.gov (Clarity)</li>
          <li>County election offices (Tier B) where the state site is not machine-readable — listed per state on its board</li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Reference data</h2>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
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
