import type { MetadataRoute } from "next";
import { isRaceOffice, raceSlug } from "@/components/race/race-content";
import { loadHistory, loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import { SITE_PAGES } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const validDate = (iso: string): Date | undefined => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export default function sitemap(): MetadataRoute.Sitemap {
  // Content changes when the reference data is rebuilt, so the build time of the data behind a page is its honest "last modified".
  // The datasets rebuild independently (`--only=history`), so /history uses its own time and state and race pages, which draw on both, the later one.
  const polls = validDate(loadPolls().builtAt);
  const history = validDate(loadHistory().builtAt);
  const lastModified = polls && history ? (polls > history ? polls : history) : (polls ?? history);

  const pages: MetadataRoute.Sitemap = SITE_PAGES.map((p) => {
    const modified = p.path === "/history" ? history : polls;
    return {
      url: absoluteUrl(p.path),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
      ...(p.dataDriven && modified ? { lastModified: modified } : {}),
    };
  });

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

  return [...pages, ...states, ...races];
}
