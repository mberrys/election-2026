import { nationRow } from "@/analytics/history";
import { buildInput, genericBallot } from "@/components/history/build-view";
import { shortDate } from "@/components/state/state-content";
import { fmtMarginDR } from "@/lib/format";
import { OG_SIZE, ogCard, type StripCell } from "@/lib/og-card";
import { SITE_NAME } from "@/lib/site";

export const alt = "Big Board 2026: live 2026 midterm election tracker";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const nation = nationRow(buildInput());
  const g = genericBallot();
  const date = shortDate(g.asOf);
  const strip: StripCell[] = Object.keys(nation.series)
    .sort()
    .map((y) => ({ label: y.slice(2), margin: nation.series[y] }));
  if (nation.projection) strip.push({ label: "26", margin: nation.projection.margin, projected: true });
  return ogCard({
    eyebrow: "2026 midterms",
    title: SITE_NAME,
    lines: [
      "Live tracker for the Nov 3, 2026 midterms",
      g.margin !== undefined ? `Generic ballot ${fmtMarginDR(g.margin)}${date ? ` (${date})` : ""}` : "Polls, ratings and county-level results",
    ],
    strip,
    stripLabel: "Presidential popular vote 1976–2024, and the generic ballot for 2026",
  });
}
