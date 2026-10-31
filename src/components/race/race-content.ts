/**
 * Search- and reader-facing text for a single race page (/race/senate-tx, /race/house-tx-15): meta title and
 * description, the share-card lines, the question-and-answer block and the related-race links. Pure functions of plain
 * data, like state-content.ts, so every number traces to a reference file and the wording is testable.
 */
import type { DistrictHistory, HistoryRow, MarginSeries, RaceMeta } from "@/data/schema";
import type { HistoryRowModel } from "@/analytics/history";
import { compact, fmtMarginDR, partyName, ratingLabel } from "@/lib/format";
import { lastTimeSentence } from "@/components/history/summary";
import {
  candidatesText,
  closeTimesText,
  lastWinQa,
  lastWins,
  matchup,
  pollText,
  ratingText,
  shortDate,
  type QA,
  type StateContentInput,
} from "@/components/state/state-content";

export type RaceOffice = "senate" | "governor" | "house";

export interface RaceContentInput {
  meta: RaceMeta;
  state: StateContentInput["state"];
  /** `history.states[abbr]`, for the Senate and governor yardsticks. */
  stateHistory?: HistoryRow;
  /** `history.districts[...]`, House races only. */
  district?: DistrictHistory;
  /** Then & Now row built from this race's own poll (statewide races only). */
  row?: HistoryRowModel;
}

export const isRaceOffice = (o: string): o is RaceOffice => o === "senate" || o === "governor" || o === "house";

/** "senate:TX" -> "senate-tx", "house:TX-15" -> "house-tx-15", "senate:FL-special" -> "senate-fl-special". */
export const raceSlug = (meta: Pick<RaceMeta, "id">): string => meta.id.replace(":", "-").toLowerCase();

const districtCode = (meta: RaceMeta): string => `${meta.state}-${meta.district ?? "AL"}`;

/** Short code for House races ("TX-15"), the state name for statewide ones. */
export function raceCode(meta: RaceMeta): string {
  return meta.office === "house" ? districtCode(meta) : meta.state;
}

/** "the Texas Senate race", "the Georgia governor's race", "the Texas 15th District House race". */
export function raceSubject(meta: RaceMeta, stateName: string): string {
  if (meta.office === "senate") return meta.special ? `the ${stateName} Senate special election` : `the ${stateName} Senate race`;
  if (meta.office === "governor") return `the ${stateName} governor's race`;
  return `the ${meta.name} House race`;
}

/** Human name for headings: "Texas Senate", "Georgia Governor", "Texas 15th District". */
export function raceHeading(meta: RaceMeta, stateName: string): string {
  if (meta.office === "senate") return meta.special ? `${stateName} Senate special election` : `${stateName} Senate`;
  if (meta.office === "governor") return `${stateName} Governor`;
  return meta.name;
}

export function raceTitle(meta: RaceMeta, stateName: string): string {
  if (meta.office === "house") return `${meta.name} (${districtCode(meta)}) 2026: Candidates, Polls & Rating`;
  if (meta.office === "governor") return `${stateName} Governor Race 2026: Candidates, Polls & Rating`;
  return `${stateName} Senate ${meta.special ? "Special Election" : "Race"} 2026: Candidates, Polls & Rating`;
}

// ---------- 2024 presidential baseline ----------

const win = (margin: number, year: 2020 | 2024): string => {
  const [d, r] = year === 2024 ? ["Kamala Harris", "Donald Trump"] : ["Joe Biden", "Donald Trump"];
  return margin > 0 ? `${d} (D)` : `${r} (R)`;
};

/** "Donald Trump (R) carried Texas by 18.0 points (R+18.0) in 2024", or undefined without a number or at an exact tie. */
function presFact(meta: RaceMeta, year: 2020 | 2024, place: string, withYear = true): string | undefined {
  const m = year === 2024 ? meta.baseline.presMargin2024 : meta.baseline.presMargin2020;
  if (m === undefined || Math.abs(m) < 0.05) return undefined;
  return `${win(m, year)} carried ${place} by ${Math.abs(m).toFixed(1)} points (${fmtMarginDR(m)})${withYear ? ` in ${year}` : ""}`;
}

function placeNoun(meta: RaceMeta, stateName: string): string {
  if (meta.office !== "house") return stateName;
  return meta.district === "AL" ? `${stateName}'s at-large district` : `the ${meta.name}`;
}

// ---------- description and card ----------

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const officeNoun: Record<RaceOffice, string> = { senate: "Senate", governor: "governor", house: "House" };

export function raceDescription({ meta, state }: RaceContentInput): string {
  const m = matchup(meta);
  const rating = meta.ratings.consensus;
  const poll = meta.polls;
  const date = shortDate(poll?.asOf);
  const lead =
    meta.office === "house"
      ? `${meta.name} (${districtCode(meta)}) 2026 House race`
      : `${state.name} 2026 ${meta.office === "senate" ? (meta.special ? "Senate special election" : "Senate race") : "governor's race"}`;
  const detail = [
    m ?? (meta.candidates.length ? `${meta.candidates.length} candidates` : ""),
    rating ? `rated ${ratingLabel[rating]}` : "",
    poll ? `poll average ${fmtMarginDR(poll.d - poll.r)}${date ? ` (${date})` : ""}` : "",
  ].filter(Boolean);
  const pres = meta.baseline.presMargin2024;
  const tail = !poll && pres !== undefined ? ` 2024 presidential margin ${fmtMarginDR(pres)}.` : "";
  const head = detail.length ? `${lead}: ${detail.join(", ")}.` : `${lead}.`;
  return clip(`${head}${tail} Candidates, rating, polls and history.`, 300);
}

/** Up to three short lines for the share card. */
export function raceCardLines({ meta, row }: RaceContentInput): string[] {
  const lines: string[] = [];
  const m = matchup(meta);
  const rating = meta.ratings.consensus;
  const poll = meta.polls;
  if (m) lines.push(m);
  else if (meta.candidates.length) lines.push(`${meta.candidates.length} candidates`);
  const detail = [rating ? `Rated ${ratingLabel[rating]}` : "", poll ? `poll average ${fmtMarginDR(poll.d - poll.r)}` : ""].filter(Boolean).join(", ");
  if (detail) lines.push(detail);
  const pres = meta.baseline.presMargin2024;
  if (pres !== undefined && !poll) lines.push(`2024 presidential margin ${fmtMarginDR(pres)}`);
  if (row?.projection && meta.office !== "house") lines.push(lastTimeSentence(row, meta.office));
  return lines.slice(0, 3);
}

// ---------- question and answer ----------

const money = (n: number) => `$${compact.format(n)}`;

function moneyText(meta: RaceMeta): string | undefined {
  const receipts = meta.money?.receipts ?? {};
  const cash = meta.money?.cashOnHand ?? {};
  const rows = meta.candidates
    .filter((c) => (receipts[c.id] ?? 0) > 0)
    .sort((a, b) => receipts[b.id] - receipts[a.id])
    .slice(0, 4)
    .map((c) => `${c.name} (${c.party}) has raised ${money(receipts[c.id])}${cash[c.id] !== undefined ? ` and has ${money(cash[c.id])} on hand` : ""}`);
  if (!rows.length) return undefined;
  const asOf = shortDate(meta.money?.asOf);
  return `${rows.join("; ")}${asOf ? `, per FEC filings through ${asOf}` : ""}.`;
}

function incumbencyText(meta: RaceMeta): string | undefined {
  const inc = meta.candidates.find((c) => c.incumbent);
  if (inc) return `${inc.name} is seeking re-election.`;
  if (meta.notes?.includes("New seat")) return "This is a new seat, so there is no incumbent.";
  if (meta.heldBy) return `No incumbent is on the ballot, so the seat is open. It is currently held by a ${partyName[meta.heldBy]}.`;
  return undefined;
}

function competitiveText(meta: RaceMeta): string | undefined {
  const c = meta.ratings.consensus;
  if (!c) return undefined;
  const label = ratingLabel[c];
  if (c === "tossup") return `Yes. The consensus rating is ${label}, the most competitive category.`;
  if (c.startsWith("tilt") || c.startsWith("lean")) return `Fairly. The consensus rating is ${label}: one party is ahead, but not by a safe margin.`;
  return `Not by the ratings. The consensus rating is ${label}, so the forecasters expect the ${c.endsWith("-d") ? "Democratic" : "Republican"} candidate to win comfortably.`;
}

function previousRaceText(meta: RaceMeta, district: DistrictHistory | undefined): string | undefined {
  const { prevRaceMargin: m, prevRaceYear: y } = meta.baseline;
  if (m === undefined || y === undefined) return undefined;
  const office = meta.office === "senate" ? "Senate" : meta.office === "governor" ? "governor's" : "House";
  const moved = district?.caveat ? " The district's lines have changed since, so that result is an approximate guide." : "";
  return `The previous ${office} race, in ${y}, was ${fmtMarginDR(m)}.${moved}`;
}

/** The long-tail question block for a race page. Every answer is built from the reference data. */
export function raceQa(input: RaceContentInput): QA[] {
  const { meta, state, stateHistory, district, row } = input;
  const subject = raceSubject(meta, state.name);
  const qa: QA[] = [];

  const incumbency = incumbencyText(meta);
  qa.push({
    q: `Who is running in ${subject} in 2026?`,
    a: [candidatesText(meta) ?? "No candidate list is available yet.", incumbency].filter(Boolean).join(" "),
  });

  const m = matchup(meta);
  const polls = pollText(meta) ?? "There is no public poll average for this race yet, so the rating and the 2024 results are the best guide.";
  qa.push({
    q: `Who is favored to win ${subject}?`,
    a: [m ? `The matchup is ${m}.` : undefined, ratingText(meta), polls, "The Big Board shows polls and ratings; it does not call races."].filter(Boolean).join(" "),
  });

  const comp = competitiveText(meta);
  const place = placeNoun(meta, state.name);
  if (comp) {
    const pres = presFact(meta, 2024, place);
    const prev = previousRaceText(meta, district);
    qa.push({ q: `Is ${subject} competitive?`, a: [comp, pres ? `${pres}.` : undefined, prev].filter(Boolean).join(" ") });
  }

  const p24 = presFact(meta, 2024, place);
  const m24 = meta.baseline.presMargin2024;
  if (!p24 && m24 !== undefined) {
    qa.push({
      q: `Did Donald Trump or Kamala Harris win ${place} in 2024?`,
      a: `Neither carried it: the 2024 presidential vote in ${place} was even in the Big Board's data (${fmtMarginDR(m24)}).`,
    });
  }
  if (p24) {
    const p20 = presFact(meta, 2020, "it", false);
    qa.push({
      q: `Did Donald Trump or Kamala Harris win ${place} in 2024?`,
      a: `${p24}.${p20 ? ` In 2020, ${p20}.` : ""}${meta.office === "house" ? " Presidential margins are on the district's 2026 lines." : ""}`,
    });
  }

  const cash = moneyText(meta);
  if (cash) qa.push({ q: `How much money have the candidates in ${subject} raised?`, a: cash });

  if (meta.office === "senate" || meta.office === "governor") {
    const series: MarginSeries | undefined = stateHistory?.[meta.office];
    const w = lastWins(series);
    if (w && w.total >= 6) {
      const noun = meta.office === "senate" ? "a Senate race" : "the governor's race";
      qa.push(lastWinQa((who) => `When did ${state.name} last elect ${who} ${meta.office === "senate" ? "to the U.S. Senate" : "as governor"}?`, noun, w));
    }
    if (row?.projection && w && w.total >= 6) {
      qa.push({ q: `When was the last time ${state.name} voted the way polls in ${subject} point?`, a: lastTimeSentence(row, meta.office) });
    }
  }

  qa.push({ q: `What time do polls close for ${subject}?`, a: closeTimesText(state) });

  if (meta.runoffRule === "majority") {
    qa.push({
      q: `Is there a runoff in ${subject}?`,
      a: `Yes. ${state.name} requires a majority winner in the general election, so if no candidate passes 50% the top two go to a runoff.`,
    });
  } else if (meta.notes && meta.office !== "house") {
    qa.push({ q: `Are there special rules for ${subject}?`, a: meta.notes });
  }

  return qa;
}

// ---------- related races ----------

export interface RelatedRace {
  slug: string;
  label: string;
  detail: string;
}

export interface RelatedGroup {
  title: string;
  races: RelatedRace[];
}

const competitive = (r: RaceMeta) => {
  const c = r.ratings.consensus;
  return c === "tossup" || (c !== undefined && (c.startsWith("tilt") || c.startsWith("lean")));
};

function relatedRace(r: RaceMeta, stateName: string): RelatedRace {
  const c = r.ratings.consensus;
  return {
    slug: raceSlug(r),
    label: r.office === "house" ? `${r.name} (${districtCode(r)})` : raceHeading(r, stateName),
    detail: c ? ratingLabel[c] : "Not rated",
  };
}

/** Other races in the same state, and other races nationally with the same rating, for internal links. */
export function relatedRaces(meta: RaceMeta, all: RaceMeta[], stateName: (abbr: string) => string): RelatedGroup[] {
  const groups: RelatedGroup[] = [];
  const sameState = all.filter((r) => r.state === meta.state && r.id !== meta.id && isRaceOffice(r.office));
  const statewide = sameState.filter((r) => r.office !== "house");
  const houses = sameState.filter((r) => r.office === "house");
  const pick = [...statewide, ...houses.filter(competitive).slice(0, 8)];
  const shown = pick.length ? pick : houses.slice(0, 6);
  if (shown.length) groups.push({ title: `More ${stateName(meta.state)} races`, races: shown.map((r) => relatedRace(r, stateName(r.state))) });

  const c = meta.ratings.consensus;
  if (c) {
    const peers = all.filter((r) => r.office === meta.office && r.id !== meta.id && r.state !== meta.state && r.ratings.consensus === c).slice(0, 8);
    if (peers.length) {
      groups.push({ title: `Other ${officeNoun[meta.office as RaceOffice]} races rated ${ratingLabel[c]}`, races: peers.map((r) => relatedRace(r, stateName(r.state))) });
    }
  }
  return groups;
}
