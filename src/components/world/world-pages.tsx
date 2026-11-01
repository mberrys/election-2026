import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { QaList, Section } from "@/components/race/race-view";
import { i18n, type I18n } from "@/i18n";
import { getLocale, worldPath, type LangCode } from "@/i18n/locales";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seo";
import { getCountry, type Country } from "./countries";
import { CatchUpList, CountryGrid, LiveBoardLink, NightTable, RacesToWatch } from "./world-sections";
import { YourTime } from "./your-time";
import { worldAlternates, worldData } from "./world-data";
import { clockLocale, countryText, localTime, worldQa } from "./world-content";

/**
 * The international guides, shared by `/world`, `/world/{country}` and their translated twins under `/{lang}/world`.
 * The route files only pick the language and call these.
 *
 * `<html lang>` is set once by the root layout and the Next.js docs offer no way to vary it per page without moving
 * every route under a `[lang]` root layout, so a translated page marks its own language on the `<article>` instead
 * (screen readers and browser translation honour element-level `lang`); the site header and footer, which are still
 * English, stay correctly labelled by the root `lang="en"`.
 */
function articleProps(i: I18n) {
  if (i.lang === "en") return {};
  const { tag, dir } = getLocale(i.lang);
  return { lang: tag, dir } as const;
}

// ---------- hub: /world, /{lang}/world ----------

export function hubMetadata(lang: LangCode): Metadata {
  const i = i18n(lang);
  return pageMetadata({ title: i.t("hub.title"), description: i.t("hub.description"), path: worldPath(lang), languages: worldAlternates() });
}

export function WorldHubPage({ lang }: { lang: LangCode }) {
  const i = i18n(lang);
  const { waves, final, catchUp } = worldData();
  const qa = worldQa(i, catchUp, waves, final);
  const pick = (et: string) => waves.find((w) => w.et === et);
  const moments = [
    { label: i.t("moment.first"), w: waves[0] },
    { label: i.t("moment.big"), w: pick("20:00") },
    { label: i.t("moment.west"), w: pick("23:00") },
  ]
    .flatMap((m) => (m.w ? [{ label: m.label, iso: m.w.utc.toISOString() }] : []))
    .concat([{ label: i.t("moment.last"), iso: final.toISOString() }]);
  const path = worldPath(lang);

  return (
    <article className="space-y-14" {...articleProps(i)}>
      <JsonLd data={webPageJsonLd({ name: i.t("hub.title"), description: i.t("hub.description"), path, inLanguage: getLocale(lang).tag })} />
      <JsonLd data={breadcrumbJsonLd([{ name: i.t("crumb.home"), path: "/" }, { name: i.t("crumb.world"), path }])} />
      <JsonLd data={faqJsonLd(qa)} />

      <header className="max-w-4xl space-y-4">
        <h1 className="page-title">{i.t("hub.h1")}</h1>
        <p className="page-lede">{i.t("hub.lede")}</p>
      </header>

      <YourTime moments={moments} heading={i.messages["your_time.heading"]} locale={lang === "en" ? undefined : i.tag} />

      <Section id="h-catch-up" title={i.t("section.catch_up")}>
        <CatchUpList i={i} c={catchUp} />
        <div className="pt-2">
          <LiveBoardLink i={i} />
        </div>
      </Section>

      <Section id="h-countries" title={i.t("hub.section_countries")}>
        <p className="max-w-[68ch] text-[15px] text-muted-foreground">{i.t("hub.countries_intro")}</p>
        <CountryGrid i={i} />
      </Section>

      <RacesToWatch i={i} c={catchUp} />

      <Section id="h-faq" title={i.t("hub.section_faq")}>
        <QaList qa={qa} />
      </Section>
    </article>
  );
}

// ---------- country: /world/{country}, /{lang}/world/{country} ----------

function countryTitle(i: I18n, c: Country): string {
  return i.t("country.title", { country: countryText(i, c).name });
}

function countryDescription(i: I18n, c: Country): string {
  const { waves } = worldData();
  const first = localTime(waves[0].utc, c.zone, clockLocale(i, c));
  const text = countryText(i, c);
  return i.t("country.description", { place: text.inName, time: first.time, city: text.city, day: first.day });
}

export function countryMetadata(lang: LangCode, slug: string): Metadata {
  const c = getCountry(slug);
  if (!c) return { title: "Not found" };
  const i = i18n(lang);
  return pageMetadata({
    title: countryTitle(i, c),
    description: countryDescription(i, c),
    path: worldPath(lang, `/${c.slug}`),
    languages: worldAlternates(c),
  });
}

export function WorldCountryPage({ lang, country: c }: { lang: LangCode; country: Country }) {
  const i = i18n(lang);
  const text = countryText(i, c);
  const { waves, final, catchUp } = worldData();
  const qa = worldQa(i, catchUp, waves, final, c);
  const locale = clockLocale(i, c);
  const t = (idx: number) => localTime(waves[idx].utc, c.zone, locale);
  const first = t(0);
  const last = localTime(final, c.zone, locale);
  const westIdx = waves.findIndex((w) => w.et === "23:00");
  const path = worldPath(lang, `/${c.slug}`);
  const title = countryTitle(i, c);

  return (
    <article className="space-y-14" {...articleProps(i)}>
      <JsonLd
        data={webPageJsonLd({
          name: title,
          description: countryDescription(i, c),
          path,
          inLanguage: lang === "en" ? c.locale : getLocale(lang).tag,
          about: { type: "Country", name: text.name },
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: i.t("crumb.home"), path: "/" },
          { name: i.t("crumb.world"), path: worldPath(lang) },
          { name: text.name, path },
        ])}
      />
      <JsonLd data={faqJsonLd(qa)} />

      <header className="max-w-4xl space-y-4">
        <nav aria-label={i.t("crumb.label")} className="text-[15px] text-muted-foreground">
          <Link href={worldPath(lang)} className="underline-offset-4 hover:text-foreground hover:underline">
            {i.t("crumb.world")}
          </Link>
        </nav>
        <h1 className="page-title">{i.t("country.h1", { country: text.short })}</h1>
        <p className="page-lede">
          {i.t("country.lede", { firstTime: first.time, firstDay: first.day, lastTime: last.time, lastDay: last.day, city: text.city, place: text.inName })}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-8 rounded-lg bg-card px-6 py-6 md:grid-cols-4 md:px-8">
        {[
          { label: i.t("moment.first"), v: first },
          { label: i.t("moment.big"), v: t(Math.max(0, waves.findIndex((w) => w.et === "20:00"))) },
          { label: i.t("moment.west"), v: westIdx >= 0 ? t(westIdx) : last },
          { label: i.t("moment.last"), v: last },
        ].map((f) => (
          <div key={f.label}>
            <dt className="text-[15px] text-muted-foreground">{f.label}</dt>
            <dd className="mt-1.5 text-[1.75rem] font-bold leading-tight tnum">{f.v.time}</dd>
            <dd className="mt-1 text-sm text-muted-foreground">{f.v.day}</dd>
          </div>
        ))}
      </dl>

      <Section id="h-night" title={i.t("country.section_night", { city: text.city })}>
        <NightTable i={i} waves={waves} country={c} />
        <p className="max-w-[68ch] text-sm text-muted-foreground">{i.t("country.night_note")}</p>
      </Section>

      <Section id="h-catch-up" title={i.t("section.catch_up")}>
        <CatchUpList i={i} c={catchUp} />
        <div className="pt-2">
          <LiveBoardLink i={i} />
        </div>
      </Section>

      <RacesToWatch i={i} c={catchUp} />

      <Section id="h-faq" title={i.t("country.section_faq", { place: text.inName })}>
        <QaList qa={qa} />
      </Section>

      <Section id="h-more" title={i.t("country.section_other")}>
        <CountryGrid i={i} current={c.slug} />
      </Section>
    </article>
  );
}
