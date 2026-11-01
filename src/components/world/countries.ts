/**
 * Countries with their own "US midterms in your time" page. English pages for readers outside the US: the slug is
 * what people type ("uk", "australia"), `hreflang` tells search engines which country each variant is for, and the
 * time zone turns US poll-closing times into local ones.
 */
export interface Country {
  slug: string;
  name: string;
  /** "in the UK", "in Australia". */
  inName: string;
  /** City whose clock the page uses: "London". */
  city: string;
  zone: string;
  /** BCP 47 tag for hreflang and date formatting. */
  locale: string;
  /** A second clock for countries that span time zones. */
  also?: { city: string; zone: string };
}

export const COUNTRIES: readonly Country[] = [
  { slug: "uk", name: "United Kingdom", inName: "in the UK", city: "London", zone: "Europe/London", locale: "en-GB" },
  { slug: "ireland", name: "Ireland", inName: "in Ireland", city: "Dublin", zone: "Europe/Dublin", locale: "en-IE" },
  { slug: "canada", name: "Canada", inName: "in Canada", city: "Toronto", zone: "America/Toronto", locale: "en-CA", also: { city: "Vancouver", zone: "America/Vancouver" } },
  { slug: "australia", name: "Australia", inName: "in Australia", city: "Sydney", zone: "Australia/Sydney", locale: "en-AU", also: { city: "Perth", zone: "Australia/Perth" } },
  { slug: "new-zealand", name: "New Zealand", inName: "in New Zealand", city: "Auckland", zone: "Pacific/Auckland", locale: "en-NZ" },
  { slug: "india", name: "India", inName: "in India", city: "New Delhi", zone: "Asia/Kolkata", locale: "en-IN" },
  { slug: "pakistan", name: "Pakistan", inName: "in Pakistan", city: "Karachi", zone: "Asia/Karachi", locale: "en-PK" },
  { slug: "singapore", name: "Singapore", inName: "in Singapore", city: "Singapore", zone: "Asia/Singapore", locale: "en-SG" },
  { slug: "philippines", name: "Philippines", inName: "in the Philippines", city: "Manila", zone: "Asia/Manila", locale: "en-PH" },
  { slug: "hong-kong", name: "Hong Kong", inName: "in Hong Kong", city: "Hong Kong", zone: "Asia/Hong_Kong", locale: "en-HK" },
  { slug: "japan", name: "Japan", inName: "in Japan", city: "Tokyo", zone: "Asia/Tokyo", locale: "en-JP" },
  { slug: "south-korea", name: "South Korea", inName: "in South Korea", city: "Seoul", zone: "Asia/Seoul", locale: "en-KR" },
  { slug: "uae", name: "United Arab Emirates", inName: "in the UAE", city: "Dubai", zone: "Asia/Dubai", locale: "en-AE" },
  { slug: "israel", name: "Israel", inName: "in Israel", city: "Jerusalem", zone: "Asia/Jerusalem", locale: "en-IL" },
  { slug: "germany", name: "Germany", inName: "in Germany", city: "Berlin", zone: "Europe/Berlin", locale: "en-DE" },
  { slug: "france", name: "France", inName: "in France", city: "Paris", zone: "Europe/Paris", locale: "en-FR" },
  { slug: "spain", name: "Spain", inName: "in Spain", city: "Madrid", zone: "Europe/Madrid", locale: "en-ES" },
  { slug: "italy", name: "Italy", inName: "in Italy", city: "Rome", zone: "Europe/Rome", locale: "en-IT" },
  { slug: "netherlands", name: "Netherlands", inName: "in the Netherlands", city: "Amsterdam", zone: "Europe/Amsterdam", locale: "en-NL" },
  { slug: "south-africa", name: "South Africa", inName: "in South Africa", city: "Johannesburg", zone: "Africa/Johannesburg", locale: "en-ZA" },
  { slug: "nigeria", name: "Nigeria", inName: "in Nigeria", city: "Lagos", zone: "Africa/Lagos", locale: "en-NG" },
  { slug: "kenya", name: "Kenya", inName: "in Kenya", city: "Nairobi", zone: "Africa/Nairobi", locale: "en-KE" },
  { slug: "mexico", name: "Mexico", inName: "in Mexico", city: "Mexico City", zone: "America/Mexico_City", locale: "en-MX" },
  { slug: "brazil", name: "Brazil", inName: "in Brazil", city: "São Paulo", zone: "America/Sao_Paulo", locale: "en-BR" },
];

export function getCountry(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
