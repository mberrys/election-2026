import Link from "next/link";
import { raceHref } from "@/lib/race-slug";
import { LinkList, Section } from "@/components/race/race-view";
import type { I18n } from "@/i18n";
import { worldPath } from "@/i18n/locales";
import { COUNTRIES, type Country } from "./countries";
import {
  catchUpItems,
  clockLocale,
  countryText,
  easternTime,
  localTime,
  raceLabel,
  waveStateNames,
  watchLabel,
  type CatchUp,
  type Wave,
} from "./world-content";

/** Election night as a timetable on one or two local clocks. */
export function NightTable({ i, waves, country }: { i: I18n; waves: Wave[]; country: Country }) {
  const text = countryText(i, country);
  const two = country.also;
  const locale = clockLocale(i, country);
  const sep = i.t("list.separator");
  return (
    <div className="overflow-x-auto rounded-lg bg-card">
      <table className="w-full min-w-[640px] text-[15px]">
        <thead>
          <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
            <th className="px-5 py-3 font-medium">{i.t("table.local_time", { city: text.city })}</th>
            {two && <th className="px-3 py-3 font-medium">{i.t("table.local_time", { city: text.alsoCity ?? "" })}</th>}
            <th className="px-3 py-3 font-medium">{i.t("table.us_eastern")}</th>
            <th className="px-3 py-3 font-medium">{i.t("table.closes_in")}</th>
            <th className="px-5 py-3 font-medium">{i.t("table.races")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {waves.map((w) => {
            const t = localTime(w.utc, country.zone, locale);
            const t2 = two ? localTime(w.utc, two.zone, locale) : undefined;
            return (
              <tr key={w.et} className="align-top">
                <td className="px-5 py-4">
                  <div className="text-lg font-bold tnum">{t.time}</div>
                  <div className="text-sm text-muted-foreground">{t.day}</div>
                </td>
                {t2 && (
                  <td className="px-3 py-4">
                    <div className="font-semibold tnum">{t2.time}</div>
                    <div className="text-sm text-muted-foreground">{t2.day}</div>
                  </td>
                )}
                <td className="px-3 py-4 text-muted-foreground tnum">{easternTime(i, w)}</td>
                <td className="px-3 py-4 leading-relaxed">{waveStateNames(i, w).join(sep)}</td>
                <td className="px-5 py-4 leading-relaxed">
                  {w.watch.length ? (
                    <span className="font-semibold">{w.watch.map((r) => watchLabel(i, r)).join(sep)}</span>
                  ) : (
                    <span className="text-muted-foreground">{i.t("table.none_close")}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The two-minute catch-up: what is decided and where it stands, from the reference data. */
export function CatchUpList({ i, c }: { i: I18n; c: CatchUp }) {
  return (
    <ul className="max-w-[68ch] space-y-4 text-[17px] leading-relaxed">
      {catchUpItems(i, c).map((it) => (
        <li key={it.lead}>
          <span className="font-bold">{it.lead}</span> <span className="text-foreground/90">{it.body}</span>
        </li>
      ))}
    </ul>
  );
}

export function RacesToWatch({ i, c }: { i: I18n; c: CatchUp }) {
  if (!c.tossups.length) return null;
  return (
    <Section id="h-watch" title={i.t("section.watch")}>
      <p className="max-w-[68ch] text-[15px] text-muted-foreground">{i.t("section.watch_intro")}</p>
      <LinkList
        items={c.tossups.map((r) => ({
          href: raceHref(r.id),
          label: raceLabel(i, r),
          detail: i.t(r.office === "senate" ? "office.senate" : "office.governor"),
        }))}
      />
    </Section>
  );
}

export function CountryGrid({ i, current }: { i: I18n; current?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {COUNTRIES.filter((c) => c.slug !== current).map((c) => {
        const text = countryText(i, c);
        return (
          <li key={c.slug}>
            <Link
              href={worldPath(i.lang, `/${c.slug}`)}
              className="flex items-baseline justify-between gap-3 rounded-md bg-s2 px-4 py-3 transition-colors outline-none hover:bg-s3 focus-visible:ring-[3px] focus-visible:ring-signal"
            >
              <span className="min-w-0 truncate font-semibold">{text.name}</span>
              <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{text.city}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The way back to the English live board: results exist only there. */
export function LiveBoardLink({ i }: { i: I18n }) {
  return (
    <Link
      href="/"
      className="inline-flex h-12 items-center rounded-md bg-signal px-6 text-[15px] font-semibold text-ground transition-opacity outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ink"
    >
      {i.t("cta.live_board")}
    </Link>
  );
}
