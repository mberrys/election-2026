import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COUNTRIES, getCountry } from "@/components/world/countries";
import { countryMetadata, WorldCountryPage } from "@/components/world/world-pages";

/** Blocking route: it awaits `params` to choose between a 404 and the page. Every country is prerendered. */
export const instant = false;

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/world/[country]">): Promise<Metadata> {
  const { country } = await params;
  return countryMetadata("en", country);
}

export default async function CountryPage({ params }: PageProps<"/world/[country]">) {
  const { country } = await params;
  const c = getCountry(country);
  if (!c) notFound();
  return <WorldCountryPage lang="en" country={c} />;
}
