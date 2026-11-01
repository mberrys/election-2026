import type { Metadata } from "next";
import Link from "next/link";
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
    <article className="max-w-5xl space-y-10">
      <header>
        <h1 className="page-title">Sources &amp; licenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The Big Board pulls live vote counts from official election authorities. We scrape no news organization&apos;s results page, and we republish no AP or network race calls. The feeds and reference tables below name every source we use. The <Link href="/methodology" className="underline-offset-2 hover:underline">methodology</Link> page explains how the projections use them.
        </p>
      </header>

      <section>
        <h2 className="text-sm text-muted-foreground mb-2">Live results feeds</h2>
        <ul className="text-sm space-y-1">
          <li>North Carolina State Board of Elections: <a href="https://er.ncsbe.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">er.ncsbe.gov</a> (statewide JSON, vote-method split)</li>
          <li>Virginia Department of Elections: <a href="https://enr.elections.virginia.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">enr.elections.virginia.gov</a> (Enhanced Voting export)</li>
          <li>Georgia Secretary of State: <a href="https://results.sos.ga.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">results.sos.ga.gov</a> (Enhanced Voting export)</li>
          <li>California Secretary of State: <a href="https://api.sos.ca.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">api.sos.ca.gov</a></li>
          <li>Minnesota Secretary of State: <a href="https://electionresultsfiles.sos.mn.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">electionresultsfiles.sos.mn.gov</a> (precinct file)</li>
          <li>Alaska Division of Elections: <a href="https://elections.alaska.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">elections.alaska.gov</a> (precinct CSV)</li>
          <li>Iowa Secretary of State: <a href="https://electionresults.iowa.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">electionresults.iowa.gov</a> (Clarity)</li>
          <li>County election offices for Tier B states, where the state site is not machine-readable. Each state board lists them.</li>
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
                  <a href="https://www.census.gov" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">U.S. Census Bureau</a> TIGER/Line 2026 (cd120) &amp; cartographic boundaries; <a href="https://github.com/topojson/us-atlas" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">us-atlas</a> 3.0.1
                </td>
                <td className="px-3 py-2 text-muted-foreground">District and county geometry. Missouri uses 119th-Congress lines.</td>
                <td className="px-3 py-2 text-muted-foreground">Public domain / ISC</td>
                <td className="px-3 py-2 text-muted-foreground">build</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h-assets" className="space-y-4">
        <h2 id="h-assets" className="section-title">
          Photos, fonts and open-source software
        </h2>
        <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">
          Candidate portraits and state capitol photos come from{" "}
          <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
            Wikimedia Commons
          </a>
          . We use only public-domain, CC0, CC BY and CC BY-SA files, and each photo carries its author and licence next to it, linked to the file page.
          Official US government portraits are public domain.
        </p>
        <ul className="grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
          {[
            ["Archivo", "https://fonts.google.com/specimen/Archivo", "SIL Open Font License 1.1"],
            ["JetBrains Mono", "https://www.jetbrains.com/lp/mono/", "SIL Open Font License 1.1"],
            ["D3 (d3-geo, d3-scale, d3-shape, d3-array)", "https://d3js.org", "ISC"],
            ["us-atlas and topojson-client", "https://github.com/topojson/us-atlas", "ISC"],
            ["Lucide icons", "https://lucide.dev", "ISC"],
            ["flag-icons (language menu flags)", "https://github.com/lipis/flag-icons", "MIT"],
            ["Recharts", "https://recharts.org", "MIT"],
            ["NumberFlow", "https://number-flow.barvian.me", "MIT"],
            ["Base UI", "https://base-ui.com", "MIT"],
            ["TanStack Query", "https://tanstack.com/query", "MIT"],
            ["Next.js and React", "https://nextjs.org", "MIT"],
          ].map(([name, href, license]) => (
            <li key={name} className="flex items-baseline justify-between gap-4 border-b border-border py-2">
              <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
                {name}
              </a>
              <span className="shrink-0 text-sm text-muted-foreground">{license}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-xs text-muted-foreground space-y-2">
        <p>
          <a href="https://en.wikipedia.org/wiki/2026_United_States_Senate_elections" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Wikipedia-derived</a> candidate lists and race ratings fall under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">CC BY-SA 4.0</a>, and our derived tables of those fields carry the same license. Vote counts are facts published by public authorities. We republish no proprietary polling or ratings text. <a href="https://www.cookpolitical.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Cook</a>, <a href="https://insideelections.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Inside Elections</a> and <a href="https://centerforpolitics.org/crystalball/" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Sabato</a> ratings appear only as categorical labels, each linked to its publisher.
        </p>
      </section>
    </article>
  );
}
