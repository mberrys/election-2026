/**
 * The /world pages are for readers outside the US. US visitors are sent to the page that serves them instead.
 * Search and link-preview crawlers are let through: Google and Bing crawl almost entirely from US addresses, and a
 * page they cannot fetch cannot rank abroad. They see exactly what a non-US reader sees.
 */
const CRAWLER =
  /bot\b|crawler|spider|slurp|googlebot|google-inspectiontool|bingbot|bingpreview|duckduckbot|applebot|yandex|baiduspider|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|embedly|redditbot/i;

export function isCrawler(userAgent: string | null): boolean {
  return !!userAgent && CRAWLER.test(userAgent);
}

/** Where a US visitor asking for a /world page goes instead, or null to serve the page. */
export function usRedirectFor(pathname: string, country: string | null, userAgent: string | null): string | null {
  if (country?.toUpperCase() !== "US" || isCrawler(userAgent)) return null;
  if (!/^\/world(\/|$)/.test(pathname)) return null;
  if (pathname.endsWith("/opengraph-image")) return null;
  return pathname === "/world" || pathname === "/world/" ? "/" : "/election-night";
}
