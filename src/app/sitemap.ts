import type { MetadataRoute } from "next";
import { isRaceOffice, raceSlug } from "@/components/race/race-content";
import { loadBuiltAt, loadRaces, loadStates } from "@/data/reference/load";
import { SITE_PAGES } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Pages draw on several datasets that rebuild independently (`--only=...`), so the one honest "last modified" is the time of
  // the last build of any kind: it can run ahead of a given page, but never behind it.
  const built = new Date(loadBuiltAt());
  const lastModified = Number.isNaN(built.getTime()) ? undefined : built;

  const pages: MetadataRoute.Sitemap = SITE_PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.dataDriven && lastModified ? { lastModified } : {}),
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

  return [...pages, ...states, ...races, ...measures];
}
