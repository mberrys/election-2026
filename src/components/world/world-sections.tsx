import Link from "next/link";
import { fmtEt, fmtMarginDR } from "@/lib/format";
import { raceHref } from "@/lib/race-slug";
import { LinkList, Section } from "@/components/race/race-view";
import { shortDate } from "@/components/state/state-content";
import { COUNTRIES, type Country } from "./countries";
import { localTime, type CatchUp, type Wave } from "./world-content";

/** Election night as a timetable on one or two local clocks. */
export function NightTable({ waves, country }: { waves: Wave[]; country: Country }) {
  const two = country.also;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] text-[15px]">
        <thead>
          <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
            <th className="px-5 py-3 font-medium">{country.city} time</th>
            {two && <th className="px-3 py-3 font-medium">{two.city} time</th>}
            <th className="px-3 py-3 font-medium">US Eastern</th>
            <th className="px-3 py-3 font-medium">Polls close in</th>
            <th className="px-5 py-3 font-medium">Races to watch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {waves.map((w) => {
            const t = localTime(w.utc, country.zone, country.locale);
            const t2 = two ? localTime(w.utc, two.zone, country.locale) : undefined;
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
                <td className="px-3 py-4 text-muted-foreground tnum">{fmtEt(w.et).replace(" ET", "")}</td>
                <td className="px-3 py-4 leading-relaxed">{w.states.join(", ")}</td>
                <td className="px-5 py-4 leading-relaxed">
                  {w.watch.length ? <span className="font-semibold">{w.watch.join(", ")}</span> : <span className="text-muted-foreground">None rated close</span>}
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
export function CatchUpList({ c }: { c: CatchUp }) {
  const items: { lead: string; body: string }[] = [
    {
      lead: "What is being decided.",
      body: `All ${c.houseSeats} seats in the House of Representatives, ${c.senateSeats} of 100 Senate seats, ${c.governors} governors, ${c.chambers} state legislative chambers and ${c.measures} statewide ballot measures. The president is not on the ballot.`,
    },
    {
      lead: "The Senate.",
      body: `Republicans control it now. By the forecasters' consensus, Democrats need ${c.senateNeedD} of the ${c.senateSeats} seats on the ballot to take control and Republicans need ${c.senateNeedR} to keep it. ${c.senateTossups} races are Toss-ups.`,
    },
    {
      lead: "The House.",
      body: `218 seats make a majority. ${c.houseLeanD} seats are rated toward the Democrats, ${c.houseLeanR} toward the Republicans, and ${c.houseTossups} are Toss-ups.`,
    },
  ];
  if (c.genericMargin != null)
    items.push({
      lead: "The national mood.",
      body: `The generic-ballot polling average, which asks which party people would vote for, is ${fmtMarginDR(c.genericMargin)}${c.genericAsOf ? ` as of ${shortDate(c.genericAsOf)}` : ""}.`,
    });
  if (c.lookalike)
    items.push({
      lead: "A historical echo.",
      body: `State by state, polling sits closest to the ${c.lookalike.year} presidential map. That is a comparison, not a forecast.`,
    });
  return (
    <ul className="max-w-[68ch] space-y-4 text-[17px] leading-relaxed">
      {items.map((it) => (
        <li key={it.lead}>
          <span className="font-bold">{it.lead}</span> <span className="text-foreground/90">{it.body}</span>
        </li>
      ))}
    </ul>
  );
}

export function RacesToWatch({ c }: { c: CatchUp }) {
  if (!c.tossups.length) return null;
  return (
    <Section id="h-watch" title="Races to watch">
      <p className="max-w-[68ch] text-[15px] text-muted-foreground">The Senate and governor races the forecasters rate as Toss-ups. Each page has the campaigns, polls and latest news.</p>
      <LinkList items={c.tossups.map((r) => ({ href: raceHref(r.id), label: r.name, detail: r.office === "senate" ? "Senate" : "Governor" }))} />
    </Section>
  );
}

export function CountryGrid({ current }: { current?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {COUNTRIES.filter((c) => c.slug !== current).map((c) => (
        <li key={c.slug}>
          <Link
            href={`/world/${c.slug}`}
            className="flex items-baseline justify-between gap-3 rounded-md bg-s2 px-4 py-3 transition-colors outline-none hover:bg-s3 focus-visible:ring-[3px] focus-visible:ring-signal"
          >
            <span className="min-w-0 truncate font-semibold">{c.name}</span>
            <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{c.city}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function LiveBoardLink() {
  return (
    <Link
      href="/"
      className="inline-flex h-12 items-center rounded-md bg-signal px-6 text-[15px] font-semibold text-ground transition-opacity outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ink"
    >
      Open the live results board
    </Link>
  );
}
