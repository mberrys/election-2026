import type { MetadataRoute } from "next";
import { COUNTRIES } from "@/components/world/countries";
import { worldAlternates } from "@/components/world/world-data";
import { TRANSLATED_LANGS, worldPath } from "@/i18n/locales";
import { isRaceOffice, raceSlug } from "@/components/race/race-content";
import { loadBuiltAt, loadRaces, loadStates } from "@/data/reference/load";
import { SITE_PAGES } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Pages draw on several datasets that rebuild independently (`--only=...`), so the one honest "last modified" is the time of
  // the last build of any kind: it can run ahead of a given page, but never behind it.
  const built = new Date(loadBuiltAt());
  const lastModified = Number.isNaN(built.getTime()) ? undefined : built;

  // Every URL of an international guide lists its whole language cluster (itself included): the same set the page's own
  // <link rel="alternate" hreflang> tags carry.
  const cluster = (alternates: Record<string, string>) => ({
    languages: Object.fromEntries(Object.entries(alternates).map(([k, v]) => [k, absoluteUrl(v)])),
  });

  const pages: MetadataRoute.Sitemap = SITE_PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.dataDriven && lastModified ? { lastModified } : {}),
    ...(p.path === worldPath("en") ? { alternates: cluster(worldAlternates()) } : {}),
  }));

  const states: MetadataRoute.Sitemap = loadStates().map((s) => ({
    url: absoluteUrl(`/state/${s.abbr}`),
    changeFrequency: "daily",
    priority: 0.6,
    ...(lastModified ? { lastModified } : {}),
  }));

  // Senate and governor races are weighted above House races, which are numerous and mostly low-traffic.
  const races: MetadataRoute.Sitemap = loadRaces()
    .filter((r) => isRaceOffice(r.office))
    .map((r) => ({
      url: absoluteUrl(`/race/${raceSlug(r)}`),
      changeFrequency: "daily",
      priority: r.office === "house" ? 0.5 : 0.6,
      ...(lastModified ? { lastModified } : {}),
    }));

  const measures: MetadataRoute.Sitemap = loadRaces()
    .filter((r) => r.office === "ballot")
    .map((r) => ({
      url: absoluteUrl(`/race/${raceSlug(r)}`),
      changeFrequency: "daily",
      priority: 0.5,
      ...(lastModified ? { lastModified } : {}),
    }));

  // Country guides for readers outside the US, in English and each translated language; the translated hubs come first.
  const world: MetadataRoute.Sitemap = [
    ...TRANSLATED_LANGS.map((lang) => ({
      url: absoluteUrl(worldPath(lang)),
      changeFrequency: "daily" as const,
      priority: 0.5,
      alternates: cluster(worldAlternates()),
      ...(lastModified ? { lastModified } : {}),
    })),
    ...COUNTRIES.flatMap((c) =>
      (["en", ...TRANSLATED_LANGS] as const).map((lang) => ({
        url: absoluteUrl(worldPath(lang, `/${c.slug}`)),
        changeFrequency: "daily" as const,
        priority: lang === "en" ? 0.5 : 0.4,
        alternates: cluster(worldAlternates(c)),
        ...(lastModified ? { lastModified } : {}),
      })),
    ),
  ];

  return [...pages, ...states, ...races, ...measures, ...world];
}
