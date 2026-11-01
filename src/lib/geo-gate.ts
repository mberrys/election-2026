import { TRANSLATED_LANGS } from "@/i18n/locales";

/**
 * The /world pages, and their translated twins under /{lang}/world, are for readers outside the US. US visitors are sent
 * to the page that serves them instead.
 * Search and link-preview crawlers are let through: Google and Bing crawl almost entirely from US addresses, and a
 * page they cannot fetch cannot rank abroad. They see exactly what a non-US reader sees.
 */
const CRAWLER =
  /bot\b|crawler|spider|slurp|googlebot|google-inspectiontool|bingbot|bingpreview|duckduckbot|applebot|yandex|baiduspider|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|embedly|redditbot/i;

export function isCrawler(userAgent: string | null): boolean {
  return !!userAgent && CRAWLER.test(userAgent);
}

/** `/world`, optionally behind one of the eight language prefixes: `/es/world`, `/ja/world/japan`. */
const WORLD_PATH = new RegExp(`^(?:/(?:${TRANSLATED_LANGS.join("|")}))?/world(?:/|$)`);
const WORLD_HUB = new RegExp(`^(?:/(?:${TRANSLATED_LANGS.join("|")}))?/world/?$`);

/** Where a US visitor asking for a /world page (in any language) goes instead, or null to serve the page. */
export function usRedirectFor(pathname: string, country: string | null, userAgent: string | null): string | null {
  if (country?.toUpperCase() !== "US" || isCrawler(userAgent)) return null;
  if (!WORLD_PATH.test(pathname)) return null;
  if (pathname.endsWith("/opengraph-image")) return null;
  return WORLD_HUB.test(pathname) ? "/" : "/election-night";
}
