import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { buildSchedule, reportingOrder } from "@/components/election-night/schedule";
import { shortDate } from "@/components/state/state-content";
import { loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo";
import { ELECTION_DAY_LABEL } from "@/lib/site";

const TITLE = "Election Night 2026: What Time Polls Close in Every State";
const DESCRIPTION =
  "Poll closing times for all 50 states and DC on Nov 3, 2026, in Eastern time, grouped by hour. See the Senate, governor and House races to watch and which states count early votes first.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/election-night" });

export default function ElectionNightPage() {
  const states = loadStates();
  const groups = buildSchedule(states, loadRaces());
  const order = reportingOrder(states);
  const updated = shortDate(loadPolls().builtAt);

  const links = (list: typeof states) =>
    list.map((s, i) => (
      <span key={s.abbr}>
        {i > 0 && ", "}
        <Link href={`/state/${s.abbr}`} className="underline-offset-2 hover:underline">
          {s.name}
        </Link>
      </span>
    ));

  return (
    <article className="max-w-4xl space-y-10">
      <JsonLd data={webPageJsonLd({ name: TITLE, description: DESCRIPTION, path: "/election-night", dateModified: loadPolls().builtAt })} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Election night", path: "/election-night" }])} />
      <header className="space-y-1">
        <h1 className="page-title">Election night 2026: when polls close</h1>
        <p className="page-lede">
          Election Day is {ELECTION_DAY_LABEL}, and all times are Eastern. States that span time zones close in more than one wave,
          so the later time is listed too. Close times come from{" "}
          <a href="https://www.thegreenpapers.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            The Green Papers
          </a>
          . Races to watch are those rated Lean or closer on the{" "}
          <Link href="/" className="underline-offset-2 hover:underline">
            Big Board
          </Link>
          {updated ? ` (data updated ${updated})` : ""}. How we build the data is on the{" "}
          <Link href="/methodology" className="underline-offset-2 hover:underline">
            methodology page
          </Link>
          .
        </p>
      </header>

      <div className="space-y-12">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`h-${g.key.replace(":", "")}`}>
            <h2 id={`h-${g.key.replace(":", "")}`} className="section-title">
              {g.label}
              {g.overnight ? " (after midnight, early Wednesday)" : ""}
            </h2>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {g.states.length} {g.states.length === 1 ? "state" : "states"}
              {g.competitiveHouse ? `, ${g.competitiveHouse} competitive House ${g.competitiveHouse === 1 ? "seat" : "seats"}` : ""}
            </p>
            <Card size="sm" className="mt-4">
              <CardContent>
                <ul className="divide-y divide-border text-[15px]">
                  {g.states.map((s) => (
                    <li key={s.abbr} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                      <span>
                        <Link href={`/state/${s.abbr}`} className="font-semibold underline-offset-4 hover:underline">
                          {s.name}
                        </Link>
                        {s.laterClose && <span className="text-muted-foreground"> · rest of state closes {s.laterClose}</span>}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {[
                          ...s.races.map((r) => `${r.label}: ${r.rating}`),
                          s.competitiveHouse ? `${s.competitiveHouse} of ${s.houseSeats} House seats competitive` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No competitive statewide or House race"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        ))}
      </div>

      <section aria-labelledby="h-order" className="space-y-4">
        <h2 id="h-order" className="section-title">
          Which states count early votes first?
        </h2>
        <p className="max-w-[68ch] text-base leading-relaxed text-muted-foreground">
          When early and mail ballots are counted first, early returns tend to favor Democrats, and their lead narrows as Election
          Day votes arrive: a blue mirage. When Election Day votes come in first, the reverse can happen: a red mirage. The orders
          below are documented for each state. States not listed have no confirmed 2026 order.{" "}
          <Link href="/explainers#mirage" className="underline-offset-2 hover:underline">
            More on mirages
          </Link>
          .
        </p>
        <Card size="sm">
          <CardContent className="space-y-3 text-[15px]">
            <p>
              <span className="font-semibold">Early and mail first:</span> {links(order.earlyFirst)}
            </p>
            <p>
              <span className="font-semibold">Election Day first:</span> {links(order.edayFirst)}
            </p>
            <p>
              <span className="font-semibold">Mixed or varies by county:</span> {links(order.mixed)}
            </p>
          </CardContent>
        </Card>
      </section>
    </article>
  );
}
