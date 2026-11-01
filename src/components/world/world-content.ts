/**
 * Content for readers outside the US: US poll-closing times turned into local clocks, a short catch-up built from the
 * reference data, and the questions people abroad search for. Pure functions of plain data, so every number traces
 * to a reference file and the wording is testable.
 */
import type { RaceMeta, StateMeta } from "@/data/schema";
import { computeBalance, seatsNeeded, SENATE_NOT_UP_2026 } from "@/analytics";
import { fmtMarginDR, ratingLabel } from "@/lib/format";
import { WATCH_RATINGS } from "@/components/election-night/schedule";
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

/** "Wednesday 4 November, 00:00" in the country's own conventions. */
export function localTime(d: Date, zone: string, locale: string): { day: string; time: string; full: string } {
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: zone }).format(d);
  // 24-hour locales read "00:00", not "0:00"; 12-hour ones keep "5:30 am".
  const h24 = /h2[34]/.test(new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle ?? "");
  const time = new Intl.DateTimeFormat(locale, { hour: h24 ? "2-digit" : "numeric", minute: "2-digit", timeZone: zone }).format(d);
  return { day, time, full: `${day}, ${time}` };
}

export interface Wave {
  /** "19:00" ET. */
  et: string;
  utc: Date;
  /** States whose polls close (all of the state, or its first part) at this time. */
  states: string[];
  /** Senate and governor races rated Lean or closer in those states. */
  watch: string[];
}

/** Poll-closing waves on election night, earliest first, keyed by when each state's polls start to close. */
export function closingWaves(states: StateMeta[], races: RaceMeta[]): Wave[] {
  const byTime = new Map<string, StateMeta[]>();
  for (const s of states) {
    const first = s.pollCloseFirstEt ?? s.pollCloseEt.split("/")[0];
    (byTime.get(first) ?? byTime.set(first, []).get(first)!).push(s);
  }
  const statewide = new Map<string, string[]>();
  for (const r of races) {
    const rating = r.ratings.consensus;
    if (!rating || !WATCH_RATINGS.has(rating) || (r.office !== "senate" && r.office !== "governor")) continue;
    const label = `${r.office === "senate" ? `${r.state} Senate` : `${r.state} governor`} (${ratingLabel[rating]})`;
    (statewide.get(r.state) ?? statewide.set(r.state, []).get(r.state)!).push(label);
  }
  return [...byTime.entries()]
    .map(([et, list]) => ({
      et,
      utc: etToUtc(et),
      states: list.map((s) => s.name).sort(),
      watch: list.flatMap((s) => statewide.get(s.abbr) ?? []),
    }))
    .sort((a, b) => a.utc.getTime() - b.utc.getTime());
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

export interface QA {
  q: string;
  a: string;
}

const party = (m: number) => (m > 0 ? "Democrats" : "Republicans");

/** Questions readers in a given country search for, answered from the data. Without a country, the hub's version. */
export function worldQa(c: CatchUp, waves: Wave[], final: Date, country?: Country): QA[] {
  const place = country ? country.inName : "outside the US";
  const zone = country?.zone ?? "UTC";
  const locale = country?.locale ?? "en-GB";
  const clock = country ? `${country.city} time` : "UTC";
  const first = waves[0];
  const big = waves.find((w) => w.et === "20:00") ?? waves[Math.min(2, waves.length - 1)];
  const mainland = waves.find((w) => w.et === "23:00");
  const t = (w: Wave) => localTime(w.utc, zone, locale).full;

  const qa: QA[] = [
    {
      q: `What time do US polls close ${place}?`,
      a: `The first polls close at ${t(first)} ${clock}${first ? ` (${first.states.slice(0, 3).join(", ")})` : ""}. The biggest wave closes at ${t(big)}, polls on the West Coast close at ${mainland ? t(mainland) : "the end of the night"}, and the last ones, in Alaska, close at ${localTime(final, zone, locale).full}.`,
    },
    {
      q: `When will the US midterm results be known ${place}?`,
      a: `Results start arriving within minutes of each closing time, from ${t(first)} ${clock}. Most races are projected overnight, which for readers ${place} usually means by the following morning or day. Close races, and states that count mail ballots slowly, can take several days. The Big Board updates every minute through the night.`,
    },
    {
      q: "What are the US midterm elections?",
      a: `Midterms are the national elections held halfway through a president's four-year term. On Tuesday, November 3, 2026, Americans elect all ${c.houseSeats} members of the House of Representatives, ${c.senateSeats} of the 100 senators${c.senateSpecials ? ` (including ${c.senateSpecials} special elections)` : ""}, ${c.governors} state governors, ${c.chambers} state legislative chambers, and vote on ${c.measures} statewide ballot measures.`,
    },
    {
      q: "Is the US president on the ballot in 2026?",
      a: "No. The president was elected in 2024 and serves until January 2029. The midterms decide which party controls Congress, which writes laws, sets the budget and, in the Senate, approves treaties, judges and cabinet nominees.",
    },
    {
      q: "Why do the US midterms matter outside America?",
      a: "Congress controls US spending, including foreign aid and defence budgets, writes tariff and trade law, can impose or lift sanctions, and the Senate must approve treaties and ambassadors. A Congress controlled by the president's opponents can block much of the president's agenda for the next two years.",
    },
    {
      q: "Who is expected to win the US Senate in 2026?",
      a: `Republicans hold the Senate going in. By the consensus of the race forecasters, Democrats need ${c.senateNeedD} of the ${c.senateSeats} seats on the ballot for control and Republicans need ${c.senateNeedR}; ${c.senateTossups} races are rated Toss-up.`,
    },
    {
      q: "Who is expected to win the US House in 2026?",
      a: `${c.houseLeanD} House seats are rated toward the Democrats, ${c.houseLeanR} toward the Republicans and ${c.houseTossups} are Toss-ups; 218 seats make a majority.${c.genericMargin != null ? ` The national generic-ballot polling average is ${fmtMarginDR(c.genericMargin)}, meaning ${party(c.genericMargin)} lead the question of which party people would vote for.` : ""}`,
    },
    {
      q: `How can I follow the US election results live ${place}?`,
      a: "The Big Board is free, needs no account and works on a phone. It shows the balance of power in the Senate and House, every race's count as states report it, and its own projections. It does not republish calls by US television networks or the Associated Press.",
    },
    {
      q: "When does the new US Congress take office?",
      a: "The new Congress is sworn in on January 3, 2027. Newly elected governors take office in January in most states.",
    },
  ];
  if (c.lookalike) {
    qa.splice(6, 0, {
      q: "Which past US election does 2026 look like?",
      a: `State by state, current polling sits closest to the ${c.lookalike.year} presidential result, an average of ${c.lookalike.meanGap} points away. Polls can move and midterm electorates differ from presidential ones, so it is a comparison, not a forecast.`,
    });
  }
  return qa;
}
