import type { CSSProperties } from "react";
import type { RatingCode } from "@/data/schema";
import { ratingLabel } from "@/lib/format";
import { ratingFill } from "./rating-color";
import { RATING_ORDER, RATING_WORD, ratingCounts } from "./ratings-strip-data";

/**
 * Races by consensus rating as one horizontal stacked bar, Solid D through Toss-up to Solid R, segments split by a
 * 2px seam and sized by count. Three big numbers lead (Democratic-leaning, toss-up, Republican-leaning); a count
 * under each of the nine rating steps labels the segments. Server-rendered; segments grow in on scroll.
 *
 *   import { RatingsStrip } from "@/components/charts/ratings-strip";
 *   <RatingsStrip races={metas} title="Senate races by rating" />
 */
export function RatingsStrip({ races, title = "Races by rating" }: { races: { ratings: { consensus?: RatingCode } }[]; title?: string }) {
  const t = ratingCounts(races);
  const rated = t.total - t.unrated;
  if (rated === 0) return null;
  const label = `${title}: ${t.dSide} lean Democratic, ${t.tossup} toss-up, ${t.rSide} lean Republican${t.unrated ? `, ${t.unrated} not rated` : ""}.`;
  const segs = RATING_ORDER.filter((r) => t.counts[r] > 0);
  return (
    <figure data-reveal className="space-y-5 rounded-lg bg-card p-4 sm:p-6">
      <h3 className="text-[15px] font-semibold text-ink-muted">{title}</h3>

      <div className="grid grid-cols-3 items-end gap-3">
        <div>
          <div className="hero-num text-4xl tnum sm:text-[40px]" style={{ color: "var(--party-d-ink)" }}>
            {t.dSide}
          </div>
          <div className="mt-1 text-[13px] text-ink-muted">Democratic</div>
        </div>
        <div className="text-center">
          <div className="hero-num text-4xl tnum sm:text-[40px]">{t.tossup}</div>
          <div className="mt-1 text-[13px] text-ink-muted">Toss-up</div>
        </div>
        <div className="text-right">
          <div className="hero-num text-4xl tnum sm:text-[40px]" style={{ color: "var(--party-r-ink)" }}>
            {t.rSide}
          </div>
          <div className="mt-1 text-[13px] text-ink-muted">Republican</div>
        </div>
      </div>

      <div role="img" aria-label={label} className="flex h-9 gap-[2px] overflow-hidden">
        {segs.map((r, i) => (
          <div
            key={r}
            title={`${ratingLabel[r]}: ${t.counts[r]}`}
            className="chart-grow-x min-w-[3px]"
            style={{ flexGrow: t.counts[r], flexBasis: 0, background: ratingFill(r), "--j": i } as CSSProperties}
          />
        ))}
      </div>

      <ol className="grid grid-cols-9 gap-[2px] text-center" aria-label="Count by rating">
        {RATING_ORDER.map((r) => (
          <li key={r} className={t.counts[r] ? "" : "opacity-50"}>
            <div className="text-lg font-bold leading-none tnum sm:text-xl">{t.counts[r]}</div>
            <div className="mt-1 text-[12px] leading-tight text-ink-muted sm:text-[13px]">{RATING_WORD[r]}</div>
          </li>
        ))}
      </ol>
      {t.unrated > 0 && <p className="text-[13px] text-ink-muted tnum">{t.unrated} not yet rated</p>}
    </figure>
  );
}
