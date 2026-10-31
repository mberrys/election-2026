import type { Metadata } from "next";
import { DEFAULT_TITLE, SITE_DESCRIPTION, SITE_NAME } from "./site";

/**
 * Per-page metadata: title, description, canonical, and matching Open Graph / Twitter tags. Next replaces `openGraph`
 * wholesale instead of merging it with the layout's, and does not apply the title template to it, so each page states
 * the full set. The share image comes from the nearest `opengraph-image` file; X falls back to it when there is no
 * `twitter:image`.
 */
export function pageMetadata({ title, description = SITE_DESCRIPTION, path }: { title?: string; description?: string; path: string }): Metadata {
  const shareTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  return {
    // Leave the key out when there is no page title: an explicit `title: undefined` wipes the layout's default title.
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, title: shareTitle, description, url: path },
    twitter: { card: "summary_large_image", title: shareTitle, description },
  };
}
