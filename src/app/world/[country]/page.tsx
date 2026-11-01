import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { QaList, Section } from "@/components/race/race-view";
import { COUNTRIES, getCountry } from "@/components/world/countries";
import { CatchUpList, CountryGrid, LiveBoardLink, NightTable, RacesToWatch } from "@/components/world/world-sections";
import { worldData, worldLanguages } from "@/components/world/world-data";
import { localTime, worldQa } from "@/components/world/world-content";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seo";

/** Blocking route: it awaits `params` to choose between a 404 and the page. Every country is prerendered. */
export const instant = false;

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.slug }));
}

const title = (name: string) => `US Midterm Election Results 2026: Times and Guide for ${name}`;

function description(slug: string): string {
  const c = getCountry(slug)!;
  const { waves } = worldData();
  const first = localTime(waves[0].utc, c.zone, c.locale);
  return `When US midterm results come in ${c.inName}: polls start closing at ${first.time} ${c.city} time on ${first.day}. What is being decided in the Senate and House, the races to watch, and how to follow live.`;
}

export async function generateMetadata({ params }: PageProps<"/world/[country]">): Promise<Metadata> {
  const { country } = await params;
  const c = getCountry(country);
  if (!c) return { title: "Not found" };
  return pageMetadata({ title: title(c.name), description: description(c.slug), path: `/world/${c.slug}`, languages: worldLanguages() });
}

export default async function CountryPage({ params }: PageProps<"/world/[country]">) {
  const { country } = await params;
  const c = getCountry(country);
  if (!c) notFound();

  const { waves, final, catchUp } = worldData();
  const qa = worldQa(catchUp, waves, final, c);
  const t = (i: number) => localTime(waves[i].utc, c.zone, c.locale);
  const first = t(0);
  const last = localTime(final, c.zone, c.locale);
  const westIdx = waves.findIndex((w) => w.et === "23:00");
  const path = `/world/${c.slug}`;

  return (
    <article className="space-y-14">
      <JsonLd data={webPageJsonLd({ name: title(c.name), description: description(c.slug), path, inLanguage: c.locale, about: { type: "Country", name: c.name } })} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Outside the US", path: "/world" }, { name: c.name, path }])} />
      <JsonLd data={faqJsonLd(qa)} />

      <header className="max-w-4xl space-y-4">
        <nav aria-label="Breadcrumb" className="text-[15px] text-muted-foreground">
          <Link href="/world" className="underline-offset-4 hover:text-foreground hover:underline">
            Outside the US
          </Link>
        </nav>
        <h1 className="page-title">US midterms 2026 in {c.name === "United Kingdom" ? "UK" : c.name} time</h1>
        <p className="page-lede">
          Polls close from {first.time} on {first.day} to {last.time} on {last.day}, {c.city} time. Here is when results arrive {c.inName}, what
          is being decided, and the races to watch.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-8 rounded-lg border border-border bg-card px-6 py-6 md:grid-cols-4 md:px-8">
        {[
          { label: "First polls close", v: first },
          { label: "Biggest wave", v: t(Math.max(0, waves.findIndex((w) => w.et === "20:00"))) },
          { label: "West Coast closes", v: westIdx >= 0 ? t(westIdx) : last },
          { label: "Last polls close", v: last },
        ].map((f) => (
          <div key={f.label}>
            <dt className="text-[15px] text-muted-foreground">{f.label}</dt>
            <dd className="mt-1.5 text-[1.75rem] font-bold leading-tight tnum">{f.v.time}</dd>
            <dd className="mt-1 text-sm text-muted-foreground">{f.v.day}</dd>
          </div>
        ))}
      </dl>

      <Section id="h-night" title={`Election night in ${c.city} time`}>
        <NightTable waves={waves} country={c} />
        <p className="max-w-[68ch] text-sm text-muted-foreground">
          Results start within minutes of each closing. Close races, and states that count mail ballots slowly, can take days.
        </p>
      </Section>

      <Section id="h-catch-up" title="Catch up in two minutes">
        <CatchUpList c={catchUp} />
        <div className="pt-2">
          <LiveBoardLink />
        </div>
      </Section>

      <RacesToWatch c={catchUp} />

      <Section id="h-faq" title={`Questions people ${c.inName} ask`}>
        <QaList qa={qa} />
      </Section>

      <Section id="h-more" title="Other countries">
        <CountryGrid current={c.slug} />
      </Section>
    </article>
  );
}
