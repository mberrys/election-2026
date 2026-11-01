import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hubMetadata, WorldHubPage } from "@/components/world/world-pages";
import { isTranslatedLang, TRANSLATED_LANGS } from "@/i18n/locales";

/**
 * `/{lang}/world`: the hub in one of the eight translated languages. This is a top-level dynamic segment, so it sits
 * below every static route (`/senate`, `/race/...`, `/state/...` all keep winning) and only ever sees paths of the
 * form `/xx/world`. `generateStaticParams` prerenders the eight real languages; any other `xx` (including `en`,
 * whose pages live at the unprefixed `/world`) falls through to `notFound()`. With Cache Components on, the
 * `dynamicParams = false` switch is unavailable, so the 404 is decided here.
 */
export const instant = false;

export function generateStaticParams() {
  return TRANSLATED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/world">): Promise<Metadata> {
  const { lang } = await params;
  return isTranslatedLang(lang) ? hubMetadata(lang) : { title: "Not found" };
}

export default async function LocalizedWorldPage({ params }: PageProps<"/[lang]/world">) {
  const { lang } = await params;
  if (!isTranslatedLang(lang)) notFound();
  return <WorldHubPage lang={lang} />;
}
