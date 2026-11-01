import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { QaList, Section } from "@/components/race/race-view";
import { CatchUpList, CountryGrid, LiveBoardLink, RacesToWatch } from "@/components/world/world-sections";
import { YourTime } from "@/components/world/your-time";
import { worldData, worldLanguages } from "@/components/world/world-data";
import { worldQa } from "@/components/world/world-content";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seo";

const TITLE = "US Midterms 2026 Explained for the Rest of the World";
const DESCRIPTION =
  "Catching up on the 2026 US midterm elections from outside America: what is being decided, who is favoured in the Senate and House, when results arrive in your time zone, and how to follow along live.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/world", languages: worldLanguages() });

export default function WorldPage() {
  const { waves, final, catchUp } = worldData();
  const qa = worldQa(catchUp, waves, final);
  const pick = (et: string) => waves.find((w) => w.et === et);
  const moments = [
    { label: "First polls close", w: waves[0] },
    { label: "Biggest wave", w: pick("20:00") },
    { label: "West Coast closes", w: pick("23:00") },
  ]
    .flatMap((m) => (m.w ? [{ label: m.label, iso: m.w.utc.toISOString() }] : []))
    .concat([{ label: "Last polls close", iso: final.toISOString() }]);

  return (
    <article className="space-y-14">
      <JsonLd data={webPageJsonLd({ name: TITLE, description: DESCRIPTION, path: "/world", inLanguage: "en" })} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Outside the US", path: "/world" }])} />
      <JsonLd data={faqJsonLd(qa)} />

      <header className="max-w-4xl space-y-4">
        <h1 className="page-title">The 2026 US midterms, explained for the rest of the world</h1>
        <p className="page-lede">
          Americans vote on Tuesday, November 3. If you are following from outside the US, here is what is being decided, where the races stand,
          and when results arrive where you are.
        </p>
      </header>

      <YourTime moments={moments} />

      <Section id="h-catch-up" title="Catch up in two minutes">
        <CatchUpList c={catchUp} />
        <div className="pt-2">
          <LiveBoardLink />
        </div>
      </Section>

      <Section id="h-countries" title="Election night in your country's time">
        <p className="max-w-[68ch] text-[15px] text-muted-foreground">Every poll-closing time on election night, converted to local time.</p>
        <CountryGrid />
      </Section>

      <RacesToWatch c={catchUp} />

      <Section id="h-faq" title="Questions people ask about the US midterms">
        <QaList qa={qa} />
      </Section>
    </article>
  );
}
