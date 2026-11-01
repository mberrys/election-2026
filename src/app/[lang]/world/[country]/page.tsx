import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COUNTRIES, getCountry } from "@/components/world/countries";
import { countryMetadata, WorldCountryPage } from "@/components/world/world-pages";
import { isTranslatedLang, TRANSLATED_LANGS } from "@/i18n/locales";

/** `/{lang}/world/{country}`: see the hub route next door for how the language segment is kept to the eight real ones. */
export const instant = false;

export function generateStaticParams() {
  return TRANSLATED_LANGS.flatMap((lang) => COUNTRIES.map((c) => ({ lang, country: c.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/world/[country]">): Promise<Metadata> {
  const { lang, country } = await params;
  return isTranslatedLang(lang) ? countryMetadata(lang, country) : { title: "Not found" };
}

export default async function LocalizedCountryPage({ params }: PageProps<"/[lang]/world/[country]">) {
  const { lang, country } = await params;
  const c = getCountry(country);
  if (!isTranslatedLang(lang) || !c) notFound();
  return <WorldCountryPage lang={lang} country={c} />;
}
