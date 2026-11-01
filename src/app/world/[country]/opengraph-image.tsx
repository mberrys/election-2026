import { COUNTRIES, getCountry } from "@/components/world/countries";
import { worldData } from "@/components/world/world-data";
import { clockLocale, countryText, localTime } from "@/components/world/world-content";
import { i18n } from "@/i18n";
import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "US midterms 2026: election night times in your country";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  const c = getCountry(country);
  if (!c) return ogCard({ eyebrow: "US midterms 2026", title: "Big Board 2026", lines: ["Not found"] });
  const en = i18n("en");
  const { city } = countryText(en, c);
  const { waves, final } = worldData();
  const first = localTime(waves[0].utc, c.zone, clockLocale(en, c));
  const last = localTime(final, c.zone, clockLocale(en, c));
  return ogCard({
    eyebrow: `US midterms 2026 · ${city} time`,
    title: `Results from ${first.time}`,
    lines: [`Polls close ${first.day}, ${first.time} to ${last.day}, ${last.time}`, "Senate, House and governors, live and free"],
  });
}
