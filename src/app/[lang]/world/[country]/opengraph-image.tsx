import { COUNTRIES } from "@/components/world/countries";
import { OG_SIZE } from "@/lib/og-card";
import { TRANSLATED_LANGS } from "@/i18n/locales";
import Image from "@/app/world/[country]/opengraph-image";

/**
 * The share card for a translated country page is the English one: the card renderer ships only a Latin font, so
 * Japanese, Korean and Chinese text would draw as empty boxes, and times and the site name read the same in every
 * language.
 */
export const alt = "US midterms 2026: election night times in your country";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TRANSLATED_LANGS.flatMap((lang) => COUNTRIES.map((c) => ({ lang, country: c.slug })));
}

export default async function LocalizedImage({ params }: { params: Promise<{ lang: string; country: string }> }) {
  const { country } = await params;
  return Image({ params: Promise.resolve({ country }) });
}
