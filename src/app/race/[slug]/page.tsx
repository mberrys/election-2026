import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { raceDescription, raceHeading, raceQa, raceTitle, relatedRaces } from "@/components/race/race-content";
import { raceContentInput, racePageSlugs } from "@/components/race/race-content-data";
import {
  measureContentInput,
  measureHeading,
  measureMetaDescription,
  measurePageSlugs,
  measureTitle,
  topicLabels,
  type MeasureContentInput,
} from "@/components/race/measure-content";
import { LiveResult } from "@/components/race/live-result";
import { NewsFeed } from "@/components/race/news-feed";
import { Campaigns, KeyFacts, LinkList, Polling, Prose, QaList, Section, SourceLine, mainCandidates, pollCloseLabel, type StoryLike } from "@/components/race/race-view";
import { getState, loadPolls, loadRaces } from "@/data/reference/load";
import { getStory } from "@/data/reference/stories";
import { ballotpediaUrl } from "@/components/states/states-lib";
import { pageMetadata } from "@/lib/page-meta";
import { raceHref } from "@/lib/race-slug";
import { partyName } from "@/lib/format";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo";
import type { RaceContentInput } from "@/components/race/race-content";

/** Blocking route, like the state page: it must await `params` to choose between a 404 and the page. All races are prerendered below. */
export const instant = false;

export function generateStaticParams() {
  return [...racePageSlugs(), ...measurePageSlugs()].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/race/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const input = raceContentInput(slug);
  if (input) return pageMetadata({ title: raceTitle(input.meta, input.state.name), description: raceDescription(input), path: `/race/${slug}` });
  const m = measureContentInput(slug);
  if (m) return pageMetadata({ title: measureTitle(m), description: measureMetaDescription(m), path: `/race/${slug}` });
  return { title: "Race not found" };
}

const BOARD = {
  senate: { path: "/senate", label: "Senate" },
  governor: { path: "/governors", label: "Governors" },
  house: { path: "/house", label: "House" },
  ballot: { path: "/states?view=measures", label: "Ballot measures" },
} as const;

/** The campaign story so far, quoted from Wikipedia at build time (scripts/build-stories.ts). */
function storyFor(id: string): StoryLike | undefined {
  return getStory(id);
}

function NewsSlot({ raceId }: { raceId: string }) {
  return <NewsFeed raceId={raceId} />;
}

const keyDateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function KeyDates({ dates }: { dates: { date: string; text: string }[] }) {
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-lg font-semibold">Key dates</h3>
      <ol className="max-w-[68ch] divide-y divide-border rounded-lg border border-border bg-card">
        {dates.map((d) => {
          const t = Date.parse(d.date);
          return (
            <li key={d.date + d.text.slice(0, 20)} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
              <span className="text-[15px] font-semibold tnum">{Number.isNaN(t) ? d.date : keyDateFmt.format(t)}</span>
              <span className="text-[15px] leading-relaxed text-foreground/90">{d.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Breadcrumb({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[15px] text-ink-muted">
      {items.map((it, i) => (
        <span key={it.href} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>/</span>}
          <Link href={it.href} className="underline-offset-4 hover:text-foreground hover:underline">
            {it.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export default async function RacePage({ params }: PageProps<"/race/[slug]">) {
  const { slug } = await params;
  const input = raceContentInput(slug);
  if (input) return <CandidateRace slug={slug} input={input} />;
  const m = measureContentInput(slug);
  if (m) return <Measure slug={slug} input={m} />;
  notFound();
}

function lede(input: RaceContentInput): string {
  const { main } = mainCandidates(input.meta);
  const who = (c: (typeof main)[number]) => `${c.name} (${c.party}${c.incumbent ? ", incumbent" : ""})`;
  if (main.length >= 2) return `${who(main[0])} faces ${who(main[1])}.`;
  if (main.length === 1) return `${who(main[0])} is the leading candidate.`;
  return "Candidates, forecast, polls and the latest news for this race.";
}

function CandidateRace({ slug, input }: { slug: string; input: RaceContentInput }) {
  const { meta, state } = input;
  const board = BOARD[meta.office as "senate" | "governor" | "house"];
  const path = `/race/${slug}`;
  const heading = raceHeading(meta, state.name);
  const name = meta.office === "house" ? `${heading} (${meta.state}-${meta.district})` : heading;
  const story = storyFor(meta.id);
  const trend = loadPolls().trend?.[meta.id];
  const close = pollCloseLabel(state.pollCloseEt);
  const groups = relatedRaces(meta, loadRaces(), (abbr) => getState(abbr)?.name ?? abbr);

  return (
    <article className="space-y-12">
      <JsonLd
        data={webPageJsonLd({
          name: raceTitle(meta, state.name),
          description: raceDescription(input),
          path,
          dateModified: loadPolls().builtAt,
          about: { type: meta.office === "house" ? "AdministrativeArea" : "State", name: meta.office === "house" ? meta.name : state.name },
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: board.label, path: board.path }, { name, path }])} />

      <header className="max-w-4xl space-y-4">
        <Breadcrumb items={[{ href: board.path, label: board.label }, { href: `/state/${state.abbr}`, label: state.name }]} />
        <h1 className="page-title">{name}</h1>
        <p className="page-lede">{lede(input)}</p>
      </header>

      <KeyFacts meta={meta} pollClose={close} />
      <LiveResult raceId={meta.id} pollClose={close} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-14">
          {story && story.overview.length > 0 && (
            <Section id="h-story" title="The race so far">
              <Prose paragraphs={story.overview} />
              {story.keyDates && story.keyDates.length > 0 && <KeyDates dates={story.keyDates} />}
              <SourceLine story={story} />
            </Section>
          )}

          <Section id="h-campaigns" title="The campaigns">
            <Campaigns meta={meta} story={story} />
          </Section>

          <Section id="h-polls" title="Polling">
            <Polling meta={meta} trend={trend} />
          </Section>

          <Section id="h-qa" title="Questions and answers">
            <QaList qa={raceQa(input)} />
          </Section>

          {groups.map((g, i) => (
            <Section key={g.title} id={`h-related-${i}`} title={g.title}>
              <LinkList items={g.races.map((r) => ({ href: `/race/${r.slug}`, label: r.label, detail: r.detail }))} />
            </Section>
          ))}
        </div>

        <aside className="lg:sticky lg:top-36 lg:self-start xl:top-28">
          <NewsSlot raceId={meta.id} />
        </aside>
      </div>
    </article>
  );
}

function Measure({ slug, input }: { slug: string; input: MeasureContentInput }) {
  const { meta, state, parts, summary, topics, siblings } = input;
  const path = `/race/${slug}`;
  const heading = measureHeading(input);
  const story = storyFor(meta.id);
  const close = pollCloseLabel(state.pollCloseEt);
  const sides = story?.campaigns.filter((c) => c.side) ?? [];
  const general = story?.campaigns.filter((c) => !c.side).flatMap((c) => c.paragraphs) ?? [];
  const storyParas = story && story.source.kind === "wikipedia" ? [...story.overview, ...general] : [];
  const facts: { label: string; value: string }[] = [
    { label: "State", value: state.name },
    { label: "Type", value: parts.kind ?? "Ballot measure" },
    { label: "Topic", value: topicLabels(topics).slice(0, 2).join(", ") || "General" },
    { label: "Polls close", value: close.replace(" ET", "") },
  ];

  return (
    <article className="space-y-12">
      <JsonLd data={webPageJsonLd({ name: measureTitle(input), description: measureMetaDescription(input), path, dateModified: loadPolls().builtAt, about: { type: "State", name: state.name } })} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Ballot measures", path: "/states?view=measures" }, { name: heading, path }])} />

      <header className="max-w-4xl space-y-4">
        <Breadcrumb
          items={[
            { href: "/states?view=measures", label: "Ballot measures" },
            { href: `/states?view=measures&state=${state.abbr}`, label: state.name },
          ]}
        />
        {parts.tag && <p className="text-lg font-bold text-muted-foreground">{parts.tag}</p>}
        <h1 className="page-title">{parts.title}</h1>
        <p className="page-lede">
          A statewide {parts.kind?.toLowerCase() ?? "measure"} on the {state.name} ballot, decided Tuesday, November 3.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-8 rounded-lg border border-border bg-card px-6 py-6 md:grid-cols-4 md:px-8">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[15px] text-ink-muted">{f.label}</dt>
            <dd className="mt-1.5 text-xl font-bold leading-tight">{f.value}</dd>
          </div>
        ))}
      </dl>

      <LiveResult raceId={meta.id} pollClose={close} measure />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-14">
          <Section id="h-what" title="What a yes vote does">
            {summary ? <Prose paragraphs={[summary]} /> : <p className="text-[17px] text-ink-muted">No summary is available yet.</p>}
            <p className="text-sm text-ink-muted">
              Summary via Wikipedia (CC BY-SA 4.0). Full text and arguments on{" "}
              <a href={ballotpediaUrl(state.name)} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
                Ballotpedia
              </a>
              .
            </p>
          </Section>

          {story && storyParas.length > 0 && (
            <Section id="h-story" title="The campaign so far">
              <Prose paragraphs={storyParas} />
              <SourceLine story={story} />
            </Section>
          )}

          {sides.length > 0 && (
            <Section id="h-sides" title="Supporters and opponents">
              <div className="grid gap-6 md:grid-cols-2">
                {sides.map((s) => (
                  <article key={s.side} className="space-y-3 rounded-lg border border-border bg-card p-6" style={{ borderTop: `3px solid ${s.side === "yes" ? "var(--signal)" : "var(--ink-faint)"}` }}>
                    <h3 className="text-2xl font-bold">{s.side === "yes" ? "Yes campaign" : "No campaign"}</h3>
                    <div className="space-y-3 text-base leading-relaxed text-foreground/90">
                      {s.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {siblings.length > 0 && (
            <Section id="h-more" title={`More on the ${state.name} ballot`}>
              <LinkList items={siblings.map((s) => ({ href: raceHref(s.id), label: s.name.replace(new RegExp(`^(20\\d\\d )?${state.name} `), "") }))} />
            </Section>
          )}

          <Section id="h-statewide" title={`${state.name} races`}>
            <LinkList
              items={loadRaces()
                .filter((r) => r.state === state.abbr && (r.office === "senate" || r.office === "governor"))
                .map((r) => ({ href: raceHref(r.id), label: raceHeading(r, state.name), detail: r.candidates.length ? `${r.candidates.length} candidates` : undefined }))
                .concat([{ href: `/state/${state.abbr}`, label: `${state.name} board`, detail: partyName.D ? "All races" : undefined }])}
            />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-36 lg:self-start xl:top-28">
          <NewsSlot raceId={meta.id} />
        </aside>
      </div>
    </article>
  );
}
