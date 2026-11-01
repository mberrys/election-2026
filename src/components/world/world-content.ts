/**
 * Content for readers outside the US: US poll-closing times turned into local clocks, a short catch-up built from the
 * reference data, and the questions people abroad search for. Pure functions of plain data plus a message catalog, so
 * every number traces to a reference file, the wording is testable, and every sentence is a whole template a
 * translator can reorder (see `src/i18n/messages/en.ts`).
 */
import type { RaceMeta, RatingCode, StateMeta } from "@/data/schema";
import { computeBalance, seatsNeeded, SENATE_NOT_UP_2026 } from "@/analytics";
import { fmtEt, ratingLabel } from "@/lib/format";
import { WATCH_RATINGS } from "@/components/election-night/schedule";
import type { I18n } from "@/i18n";
import type { Country } from "./countries";

/** US Eastern is UTC-5 on Election Day: daylight time ended on Sunday, November 1, 2026. */
const ET_OFFSET_HOURS = 5;
const VP_PARTY = "R" as const;

/** "19:00" ET on Election Day (or "01:00", which is early Wednesday) as a UTC instant. */
export function etToUtc(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const day = h < 6 ? 4 : 3; // closings after midnight ET fall on Wednesday, November 4
  return new Date(Date.UTC(2026, 10, day, h + ET_OFFSET_HOURS, m));
}

/** "Wednesday 4 November, 00:00" in the locale's own conventions ("miércoles, 4 de noviembre, 1:00" in Spanish). */
export function localTime(d: Date, zone: string, locale: string): { day: string; time: string; full: string } {
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: zone }).format(d);
  // 24-hour locales read "00:00", not "0:00"; 12-hour ones keep "5:30 am".
  const h24 = /h2[34]/.test(new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle ?? "");
  const time = new Intl.DateTimeFormat(locale, { hour: h24 ? "2-digit" : "numeric", minute: "2-digit", timeZone: zone }).format(d);
  return { day, time, full: `${day}, ${time}` };
}

/**
 * The locale dates and clocks are formatted in. English pages keep each country's own flavour (en-GB, en-AU); every
 * other language formats in that language, with the country's time zone supplying the clock.
 */
export function clockLocale(i: I18n, country?: Country): string {
  return i.lang === "en" ? (country?.locale ?? "en-GB") : i.tag;
}

/** A country's wording from the catalog: its name, the short form for headings, "in Spain", and the clock cities. */
export function countryText(i: I18n, c: Country) {
  const get = (part: string) => i.lookup(`country.${c.slug}.${part}`) ?? c.slug;
  return {
    name: get("name"),
    short: get("short"),
    inName: get("in"),
    city: get("city"),
    alsoCity: c.also ? get("city_also") : undefined,
  };
}

/** A US state's name in the page's language. */
export function stateName(i: I18n, abbr: string): string {
  return i.lookup(`state.${abbr}`) ?? abbr;
}

/** A forecast margin as "D+8.6" / "R+3.2" / "Even", with the language's own decimal mark. */
export function marginLabel(i: I18n, m: number): string {
  if (Math.abs(m) < 0.05) return i.t("margin.even");
  const n = i.num(Math.abs(m), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return i.t(m > 0 ? "margin.d" : "margin.r", { n });
}

/** "Oct 30" in English, "30 oct" in French: the month and day of a date given as an ISO string. */
export function shortDateIn(i: I18n, iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return new Intl.DateTimeFormat(i.lang === "en" ? "en-US" : i.tag, { month: "short", day: "numeric", timeZone: "UTC" }).format(t);
}

/** The Eastern clock time of a poll closing: "7 PM" in English, the language's own format elsewhere. */
export function easternTime(i: I18n, w: Wave): string {
  return i.lang === "en" ? fmtEt(w.et).replace(" ET", "") : localTime(w.utc, "America/New_York", i.tag).time;
}

/** A Senate or governor race the forecasters rate as close. */
export interface WatchRace {
  office: "senate" | "governor";
  /** Two-letter state code. */
  state: string;
  rating: RatingCode;
}

export interface Wave {
  /** "19:00" ET. */
  et: string;
  utc: Date;
  /** Postal codes of the states whose polls close (all of the state, or its first part) at this time, in English name order. */
  states: string[];
  /** States whose remaining polls close at this time, after part of the state closed in an earlier wave. */
  rest: string[];
  /** Senate and governor races rated Lean or closer in those states. */
  watch: WatchRace[];
}

/** Poll-closing waves on election night, earliest first, keyed by when each state's polls start to close. */
export function closingWaves(states: StateMeta[], races: RaceMeta[]): Wave[] {
  const byTime = new Map<string, StateMeta[]>();
  const restByTime = new Map<string, StateMeta[]>();
  for (const s of states) {
    const times = s.pollCloseEt.split("/");
    const first = s.pollCloseFirstEt ?? times[0];
    (byTime.get(first) ?? byTime.set(first, []).get(first)!).push(s);
    const last = times.at(-1)!;
    if (last !== first) {
      (restByTime.get(last) ?? restByTime.set(last, []).get(last)!).push(s);
      if (!byTime.has(last)) byTime.set(last, []);
    }
  }
  const statewide = new Map<string, WatchRace[]>();
  for (const r of races) {
    const rating = r.ratings.consensus;
    if (!rating || !WATCH_RATINGS.has(rating) || (r.office !== "senate" && r.office !== "governor")) continue;
    (statewide.get(r.state) ?? statewide.set(r.state, []).get(r.state)!).push({ office: r.office, state: r.state, rating });
  }
  return [...byTime.entries()]
    .map(([et, list]) => ({
      et,
      utc: etToUtc(et),
      states: [...list].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).map((s) => s.abbr),
      rest: (restByTime.get(et) ?? []).map((s) => s.abbr),
      watch: list.flatMap((s) => statewide.get(s.abbr) ?? []),
    }))
    .sort((a, b) => a.utc.getTime() - b.utc.getTime());
}

/** The states closing in a wave, named in the page's language and sorted by those names. */
export function waveStateNames(i: I18n, w: Wave): string[] {
  const names = w.states.map((abbr) => stateName(i, abbr)).sort((a, b) => a.localeCompare(b, i.tag));
  const rest = w.rest.map((abbr) => i.t("table.rest_of_state", { state: stateName(i, abbr) })).sort((a, b) => a.localeCompare(b, i.tag));
  return [...names, ...rest];
}

/** "TX Senate (Lean R)" in the page's language. */
export function watchLabel(i: I18n, r: WatchRace): string {
  const rating = i.lookup(`rating.${r.rating}`) ?? ratingLabel[r.rating];
  return i.t(r.office === "senate" ? "watch.senate" : "watch.governor", { state: r.state, rating });
}

/** "Georgia Governor", "Ohio Senate (special)" in the page's language. */
export function raceLabel(i: I18n, r: RaceMeta): string {
  const state = stateName(i, r.state);
  if (r.office === "governor") return i.t("race.governor", { state });
  if (r.office === "senate") return i.t(r.special ? "race.senate_special" : "race.senate", { state });
  return r.name;
}

/** The last polls of the night (western Alaska), from each state's final closing time. */
export function finalClose(states: StateMeta[]): Date {
  return new Date(Math.max(...states.map((s) => etToUtc(s.pollCloseEt.split("/").pop() ?? s.pollCloseEt).getTime())));
}

export interface CatchUp {
  houseSeats: number;
  senateSeats: number;
  senateSpecials: number;
  governors: number;
  measures: number;
  chambers: number;
  senateNeedD: number;
  senateNeedR: number;
  senateTossups: number;
  houseLeanD: number;
  houseLeanR: number;
  houseTossups: number;
  genericMargin?: number;
  genericAsOf?: string;
  /** Closest past presidential map to the 2026 projection. */
  lookalike?: { year: number; meanGap: number };
  /** Senate and governor races rated Toss-up, closest first. */
  tossups: RaceMeta[];
}

export function catchUp(
  races: RaceMeta[],
  generic: { margin?: number; asOf?: string },
  lookalike?: { year: number; meanGap: number },
): CatchUp {
  const by = (o: string) => races.filter((r) => r.office === o);
  const senate = computeBalance("senate", [], races, SENATE_NOT_UP_2026);
  const house = computeBalance("house", [], races);
  return {
    houseSeats: by("house").length,
    senateSeats: by("senate").length,
    senateSpecials: by("senate").filter((r) => r.special).length,
    governors: by("governor").length,
    measures: by("ballot").length,
    chambers: by("stateleg").length,
    senateNeedD: seatsNeeded(senate, "D", { vpParty: VP_PARTY }),
    senateNeedR: seatsNeeded(senate, "R", { vpParty: VP_PARTY }),
    senateTossups: senate.tossup,
    houseLeanD: house.leaning.D + house.leaning.I,
    houseLeanR: house.leaning.R,
    houseTossups: house.tossup,
    genericMargin: generic.margin,
    genericAsOf: generic.asOf,
    lookalike,
    tossups: races.filter((r) => (r.office === "senate" || r.office === "governor") && r.ratings.consensus === "tossup"),
  };
}

/** The counts the catch-up and answer templates share, as template variables. */
function countVars(c: CatchUp) {
  return {
    house: c.houseSeats,
    senate: c.senateSeats,
    specials: c.senateSpecials,
    governors: c.governors,
    chambers: c.chambers,
    measures: c.measures,
    needD: c.senateNeedD,
    needR: c.senateNeedR,
    leanD: c.houseLeanD,
    leanR: c.houseLeanR,
  };
}

/** The two-minute catch-up: a bold lead-in and a body each, from the reference data. */
export function catchUpItems(i: I18n, c: CatchUp): { lead: string; body: string }[] {
  const v = countVars(c);
  const items = [
    { lead: i.t("catchup.decided_lead"), body: i.t("catchup.decided_body", v) },
    { lead: i.t("catchup.senate_lead"), body: i.t("catchup.senate_body", { ...v, tossups: c.senateTossups }) },
    { lead: i.t("catchup.house_lead"), body: i.t("catchup.house_body", { ...v, tossups: c.houseTossups }) },
  ];
  if (c.genericMargin != null) {
    const margin = marginLabel(i, c.genericMargin);
    const date = shortDateIn(i, c.genericAsOf);
    items.push({
      lead: i.t("catchup.mood_lead"),
      body: date ? i.t("catchup.mood_body_asof", { margin, date }) : i.t("catchup.mood_body", { margin }),
    });
  }
  if (c.lookalike) items.push({ lead: i.t("catchup.echo_lead"), body: i.t("catchup.echo_body", { year: c.lookalike.year }) });
  return items;
}

export interface QA {
  q: string;
  a: string;
}

/** Questions readers in a given country search for, answered from the data. Without a country, the hub's version. */
export function worldQa(i: I18n, c: CatchUp, waves: Wave[], final: Date, country?: Country): QA[] {
  const text = country ? countryText(i, country) : undefined;
  const place = text ? text.inName : i.t("place.world");
  const zone = country?.zone ?? "UTC";
  const locale = clockLocale(i, country);
  const clock = text ? i.t("clock.city", { city: text.city }) : i.t("clock.utc");
  const first = waves[0];
  const big = waves.find((w) => w.et === "20:00") ?? waves[Math.min(2, waves.length - 1)];
  const mainland = waves.find((w) => w.et === "23:00");
  const at = (w: Wave) => localTime(w.utc, zone, locale).full;
  const v = countVars(c);

  const qa: QA[] = [
    {
      q: i.t("qa.close_q", { place }),
      a: i.t("qa.close_a", {
        first: at(first),
        clock,
        states: waveStateNames(i, first).slice(0, 3).join(i.t("list.separator")),
        big: at(big),
        west: mainland ? at(mainland) : i.t("qa.end_of_night"),
        last: localTime(final, zone, locale).full,
      }),
    },
    { q: i.t("qa.results_q", { place }), a: i.t("qa.results_a", { first: at(first), clock, place }) },
    { q: i.t("qa.what_q"), a: i.t(c.senateSpecials ? "qa.what_a_specials" : "qa.what_a", v) },
    { q: i.t("qa.president_q"), a: i.t("qa.president_a") },
    { q: i.t("qa.matter_q"), a: i.t("qa.matter_a") },
    { q: i.t("qa.senate_q"), a: i.t("qa.senate_a", { ...v, tossups: c.senateTossups }) },
    {
      q: i.t("qa.house_q"),
      a:
        c.genericMargin != null
          ? i.t("qa.house_a_generic", {
              ...v,
              tossups: c.houseTossups,
              margin: marginLabel(i, c.genericMargin),
              party: i.t(c.genericMargin > 0 ? "party.democrats" : "party.republicans"),
            })
          : i.t("qa.house_a", { ...v, tossups: c.houseTossups }),
    },
    { q: i.t("qa.live_q", { place }), a: i.t("qa.live_a") },
    { q: i.t("qa.congress_q"), a: i.t("qa.congress_a") },
  ];
  if (c.lookalike) {
    qa.splice(6, 0, {
      q: i.t("qa.echo_q"),
      a: i.t("qa.echo_a", { year: c.lookalike.year, gap: i.num(c.lookalike.meanGap, { maximumFractionDigits: 1 }) }),
    });
  }
  return qa;
}
