import { stateCardLines } from "@/components/state/state-content";
import { stateContentInput } from "@/components/state/state-content-data";
import { loadStates } from "@/data/reference/load";
import { OG_SIZE, ogCard, type StripCell } from "@/lib/og-card";

export const alt = "Big Board 2026 state page: polls, ratings and presidential history";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return loadStates().map((s) => ({ st: s.abbr }));
}

export default async function Image({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params;
  const input = stateContentInput(st);
  if (!input) return ogCard({ eyebrow: "2026 midterms", title: "Big Board 2026", lines: ["State not found"] });

  const series = input.history?.pres ?? {};
  const strip: StripCell[] = Object.keys(series)
    .sort()
    .map((y) => ({ label: y.slice(2), margin: series[y] }));
  const p = input.row?.projection;
  if (p) strip.push({ label: "26", margin: p.margin, projected: true });

  return ogCard({
    eyebrow: "2026 election · polls and history",
    title: input.state.name,
    lines: stateCardLines(input),
    strip: strip.length ? strip : undefined,
    stripLabel: "Presidential margin 1976–2024, and the 2026 projection",
  });
}
