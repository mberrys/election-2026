import type { MetadataRoute } from "next";
import { loadPolls, loadStates } from "@/data/reference/load";
import { SITE_PAGES } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Content changes when the reference data is rebuilt, so that build time is the honest "last modified".
  const built = new Date(loadPolls().builtAt);
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

  return [...pages, ...states];
}
