import { stripInline } from "./inline-links";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "./site";

/** Static top-level pages in the sitemap. `/senate/[state]` only redirects and `/api/*` is not for crawlers. */
export const SITE_PAGES: ReadonlyArray<{
  path: string;
  changeFrequency: "hourly" | "daily" | "weekly" | "monthly";
  priority: number;
  /** Whether the page content changes with the reference data build. */
  dataDriven: boolean;
}> = [
  { path: "/", changeFrequency: "hourly", priority: 1, dataDriven: true },
  { path: "/senate", changeFrequency: "hourly", priority: 0.9, dataDriven: true },
  { path: "/house", changeFrequency: "hourly", priority: 0.9, dataDriven: true },
  { path: "/governors", changeFrequency: "hourly", priority: 0.9, dataDriven: true },
  { path: "/states", changeFrequency: "daily", priority: 0.7, dataDriven: true },
  { path: "/election-night", changeFrequency: "daily", priority: 0.8, dataDriven: true },
  { path: "/history", changeFrequency: "daily", priority: 0.7, dataDriven: true },
  { path: "/explainers", changeFrequency: "weekly", priority: 0.6, dataDriven: true },
  { path: "/world", changeFrequency: "daily", priority: 0.6, dataDriven: true },
  { path: "/ballot", changeFrequency: "monthly", priority: 0.5, dataDriven: false },
  { path: "/methodology", changeFrequency: "monthly", priority: 0.4, dataDriven: false },
  { path: "/sources", changeFrequency: "monthly", priority: 0.3, dataDriven: false },
];

/** Compact, HTML-safe JSON for a `<script type="application/ld+json">` body (escapes `<` per the Next.js guide). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteJsonLd(base: string = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    url: base,
    description: SITE_DESCRIPTION,
    inLanguage: "en-US",
  };
}

/** A page of the site, with its last data refresh. `about` names the place when the page is about one. */
export function webPageJsonLd(
  opts: { name: string; description: string; path: string; dateModified?: string; about?: { type: string; name: string }; inLanguage?: string },
  base: string = SITE_URL,
) {
  const url = absoluteUrl(opts.path, base);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description,
    inLanguage: opts.inLanguage ?? "en-US",
    isPartOf: { "@id": `${base}/#website` },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    ...(opts.about
      ? { about: { "@type": opts.about.type, name: opts.about.name, containedInPlace: { "@type": "Country", name: "United States" } } }
      : {}),
  };
}

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; path: string }>, base: string = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path, base),
    })),
  };
}

/** The history data behind /history, described for dataset search. License is omitted: sources differ (CC0, CC BY-SA). */
export function historyDatasetJsonLd(opts: { firstYear: number; lastYear: number; dateModified?: string }, base: string = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "US election margins by state, 1976 to 2024, with 2026 poll projections",
    description:
      "Democratic minus Republican margins for presidential elections by state and nationally, Senate and governor margins, and House district margins, set against current 2026 polling.",
    url: absoluteUrl("/history", base),
    isAccessibleForFree: true,
    inLanguage: "en-US",
    temporalCoverage: `${opts.firstYear}/${opts.lastYear}`,
    spatialCoverage: { "@type": "Country", name: "United States" },
    variableMeasured: "Margin between Democratic and Republican vote share, in percentage points",
    isBasedOn: [
      "https://doi.org/10.7910/DVN/42MVDX",
      "https://en.wikipedia.org/wiki/United_States_elections",
      "https://votehub.com/polls/api",
    ],
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

/** Question-and-answer block for rich results. Answers are plain text. */
export function faqJsonLd(qa: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: stripInline(x.a) } })),
  };
}
