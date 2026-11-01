/**
 * Countries with their own "US midterms in your time" page, in English and in every translated language. The slug is
 * what people type ("uk", "australia") and is the same in every language; the time zone turns US poll-closing times
 * into local ones. Names, the city shown on the clock and the "in Spain" phrasing live in the message catalog
 * (`country.{slug}.name` and friends), so each language writes its own.
 */
export interface Country {
  slug: string;
  zone: string;
  /** BCP 47 tag of the English page, for hreflang and date formatting: en-GB reads "Wednesday 4 November". */
  locale: string;
  /** A second clock for countries that span time zones; its city is the catalog key `country.{slug}.city_also`. */
  also?: { zone: string };
}

export const COUNTRIES: readonly Country[] = [
  { slug: "uk", zone: "Europe/London", locale: "en-GB" },
  { slug: "ireland", zone: "Europe/Dublin", locale: "en-IE" },
  { slug: "canada", zone: "America/Toronto", locale: "en-CA", also: { zone: "America/Vancouver" } },
  { slug: "australia", zone: "Australia/Sydney", locale: "en-AU", also: { zone: "Australia/Perth" } },
  { slug: "new-zealand", zone: "Pacific/Auckland", locale: "en-NZ" },
  { slug: "india", zone: "Asia/Kolkata", locale: "en-IN" },
  { slug: "pakistan", zone: "Asia/Karachi", locale: "en-PK" },
  { slug: "singapore", zone: "Asia/Singapore", locale: "en-SG" },
  { slug: "philippines", zone: "Asia/Manila", locale: "en-PH" },
  { slug: "hong-kong", zone: "Asia/Hong_Kong", locale: "en-HK" },
  { slug: "japan", zone: "Asia/Tokyo", locale: "en-JP" },
  { slug: "south-korea", zone: "Asia/Seoul", locale: "en-KR" },
  { slug: "uae", zone: "Asia/Dubai", locale: "en-AE" },
  { slug: "israel", zone: "Asia/Jerusalem", locale: "en-IL" },
  { slug: "germany", zone: "Europe/Berlin", locale: "en-DE" },
  { slug: "france", zone: "Europe/Paris", locale: "en-FR" },
  { slug: "spain", zone: "Europe/Madrid", locale: "en-ES" },
  { slug: "italy", zone: "Europe/Rome", locale: "en-IT" },
  { slug: "netherlands", zone: "Europe/Amsterdam", locale: "en-NL" },
  { slug: "south-africa", zone: "Africa/Johannesburg", locale: "en-ZA" },
  { slug: "nigeria", zone: "Africa/Lagos", locale: "en-NG" },
  { slug: "kenya", zone: "Africa/Nairobi", locale: "en-KE" },
  { slug: "mexico", zone: "America/Mexico_City", locale: "en-MX" },
  { slug: "brazil", zone: "America/Sao_Paulo", locale: "en-BR" },
];

export function getCountry(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
