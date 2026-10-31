import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyDot, RatingBadge } from "@/components/board/status-badge";
import { JsonLd } from "@/components/seo/json-ld";
import { Card, CardContent } from "@/components/ui/card";
import { raceDescription, raceHeading, raceQa, raceTitle, relatedRaces } from "@/components/race/race-content";
import { raceContentInput, racePageSlugs } from "@/components/race/race-content-data";
import { shortDate } from "@/components/state/state-content";
import { getState, loadPolls, loadRaces } from "@/data/reference/load";
import { compact, fmtMarginDR, partyName } from "@/lib/format";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo";
import { ELECTION_DAY_LABEL } from "@/lib/site";

/** Blocking route, like the state page: it must await `params` to choose between a 404 and the page. All races are prerendered below. */
export const instant = false;

export function generateStaticParams() {
  return racePageSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/race/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const input = raceContentInput(slug);
  if (!input) return { title: "Race not found" };
  return pageMetadata({ title: raceTitle(input.meta, input.state.name), description: raceDescription(input), path: `/race/${slug}` });
}

const BOARD = {
  senate: { path: "/senate", label: "Senate" },
  governor: { path: "/governors", label: "Governors" },
  house: { path: "/house", label: "House" },
} as const;

const link = "underline-offset-2 hover:underline";

/** Democrats first, then Republicans, then everyone else, like the question-and-answer text. */
const partyOrder = (p: string) => (p === "D" ? 0 : p === "R" ? 1 : 2);

export default async function RacePage({ params }: PageProps<"/race/[slug]">) {
  const { slug } = await params;
  const input = raceContentInput(slug);
  if (!input) notFound();

  const { meta, state } = input;
  const office = meta.office as keyof typeof BOARD;
  const board = BOARD[office];
  const path = `/race/${slug}`;
  const heading = raceHeading(meta, state.name);
  const qa = raceQa(input);
  const groups = relatedRaces(meta, loadRaces(), (abbr) => getState(abbr)?.name ?? abbr);
  const updated = shortDate(loadPolls().builtAt);
  const poll = meta.polls;
  const pres = meta.baseline.presMargin2024;
  const receipts = meta.money?.receipts ?? {};
  const cash = meta.money?.cashOnHand ?? {};
  const name = meta.office === "house" ? `${heading} (${meta.state}-${meta.district})` : heading;

  return (
    <article className="max-w-4xl space-y-6">
      <JsonLd
        data={webPageJsonLd({
          name: raceTitle(meta, state.name),
          description: raceDescription(input),
          path,
          dateModified: loadPolls().builtAt,
          about: { type: meta.office === "house" ? "AdministrativeArea" : "State", name: meta.office === "house" ? meta.name : state.name },
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: board.label, path: board.path },
          { name, path },
        ])}
      />

      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href={board.path} className={link}>
            {board.label}
          </Link>
          {" / "}
          <Link href={`/state/${state.abbr}`} className={link}>
            {state.name}
          </Link>
        </nav>
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">{name} 2026</h1>
        <p className="text-sm text-muted-foreground">
          Election Day is {ELECTION_DAY_LABEL}. Candidates, the consensus rating, polls and the 2024 baseline for this race
          {updated ? ` (data updated ${updated})` : ""}. The Big Board shows projections; it does not call races.
        </p>
      </header>

      <Card size="sm">
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Consensus rating</dt>
              <dd className="mt-0.5">{meta.ratings.consensus ? <RatingBadge rating={meta.ratings.consensus} /> : "Not rated"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Poll average</dt>
              <dd className="mt-0.5 font-medium tnum">
                {poll ? fmtMarginDR(poll.d - poll.r) : "No average yet"}
                {poll && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {poll.n} polls{shortDate(poll.asOf) ? `, to ${shortDate(poll.asOf)}` : ""}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">2024 presidential margin</dt>
              <dd className="mt-0.5 font-medium tnum">{pres !== undefined ? fmtMarginDR(pres) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Held by</dt>
              <dd className="mt-0.5 font-medium">{meta.heldBy ? partyName[meta.heldBy] : "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="h-candidates" className="space-y-2">
        <h2 id="h-candidates" className="display text-lg font-bold tracking-tight">
          Candidates
        </h2>
        <Card size="sm">
          <CardContent>
            <ul className="divide-y divide-border/60 text-sm">
              {[...meta.candidates]
                .sort((a, b) => partyOrder(a.party) - partyOrder(b.party))
                .map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
                  <span className="flex items-center gap-2">
                    <PartyDot party={c.party} />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {partyName[c.party]}
                      {c.incumbent ? ", incumbent" : ""}
                    </span>
                  </span>
                  {receipts[c.id] ? (
                    <span className="text-xs text-muted-foreground tnum">
                      ${compact.format(receipts[c.id])} raised
                      {cash[c.id] !== undefined ? `, $${compact.format(cash[c.id])} on hand` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-label={`Questions about ${name}`} className="space-y-2">
        <h2 className="display text-lg font-bold tracking-tight">{name}: questions and answers</h2>
        <Card size="sm">
          <CardContent className="space-y-4">
            {qa.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              More:{" "}
              <Link href={`/state/${state.abbr}`} className={link}>
                {state.name} county results and history
              </Link>
              {" · "}
              <Link href={board.path} className={link}>
                all {board.label} races
              </Link>
              {" · "}
              <Link href="/election-night" className={link}>
                poll closing times
              </Link>
              {" · "}
              <Link href="/explainers" className={link}>
                how ratings and projections work
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>

      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="space-y-2">
          <h2 className="display text-lg font-bold tracking-tight">{g.title}</h2>
          <Card size="sm">
            <CardContent>
              <ul className="divide-y divide-border/60 text-sm">
                {g.races.map((r) => (
                  <li key={r.slug} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5">
                    <Link href={`/race/${r.slug}`} className={`font-medium ${link}`}>
                      {r.label}
                    </Link>
                    <span className="text-xs text-muted-foreground">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ))}
    </article>
  );
}
