import { raceCardLines, raceCode, raceHeading, type RaceOffice } from "@/components/race/race-content";
import { raceContentInput, racePageSlugs } from "@/components/race/race-content-data";
import { measureContentInput, measurePageSlugs } from "@/components/race/measure-content";
import { OG_SIZE, ogCard, type StripCell } from "@/lib/og-card";

export const alt = "Big Board 2026 race page: candidates, rating, polls and history";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return [...racePageSlugs(), ...measurePageSlugs()].map((slug) => ({ slug }));
}

const OFFICE = { senate: "Senate", governor: "governor", house: "House" } as const;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const input = raceContentInput(slug);
  if (!input) return ogCard({ eyebrow: "2026 midterms", title: "Big Board 2026", lines: ["Race not found"] });

  const { meta, state, stateHistory, district, row } = input;
  const office = meta.office as RaceOffice;
  const house = office === "house";
  const series = (house ? district?.pres : stateHistory?.[office as "senate" | "governor"]) ?? {};
  const strip: StripCell[] = Object.keys(series)
    .sort()
    .map((y) => ({ label: y.slice(2), margin: series[y] }));
  const p = row?.projection;
  if (p) strip.push({ label: "26", margin: p.margin, projected: true });

  const title = house ? raceCode(meta) : meta.special ? `${state.name} Senate (special)` : raceHeading(meta, state.name);
  return ogCard({
    eyebrow: house ? `${meta.name} · 2026 House race` : `2026 ${OFFICE[office]} race`,
    title,
    lines: raceCardLines(input),
    strip: strip.length ? strip : undefined,
    stripLabel: house ? "Presidential margin 2020–2024, and the 2026 projection" : `${OFFICE[office][0].toUpperCase()}${OFFICE[office].slice(1)} margin by year, and the 2026 projection`,
  });
}
