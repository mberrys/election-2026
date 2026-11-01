/**
 * Search- and reader-facing text for a state page, derived from the reference data: the meta title and description,
 * and the question-and-answer block ("What time do polls close in Texas?", "When did Texas last vote for a Democrat
 * for president?"). Pure functions of plain data so the wording is testable and every number traces to a source file.
 */
import type { HistoryRow, MarginSeries, Party, RaceMeta } from "@/data/schema";
import type { StateRef } from "@/data/reference/load";
import type { HistoryRowModel } from "@/analytics/history";
import { fmtEt, fmtMarginDR, partyName, ratingLabel } from "@/lib/format";
import { ELECTION_DAY_LABEL } from "@/lib/site";
import { lastTimeSentence } from "@/components/history/summary";
import { raceHref } from "@/lib/race-slug";

export interface QA {
  q: string;
  a: string;
}

export interface StateContentInput {
  state: Pick<StateRef, "abbr" | "name" | "pollCloseEt" | "pollCloseFirstEt" | "voteOrder" | "voteOrderNote" | "pollCloseSource">;
  /** Every race in the state (Senate, governor, House, ballot measures). */
  races: RaceMeta[];
  /** `history.states[abbr]`. */
  history?: HistoryRow;
  /** Presidential Flashback row for the state. */
  row?: HistoryRowModel;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "2026-10-28" or a full ISO timestamp -> "Oct 28". */
export function shortDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : dateFmt.format(t);
}

const RATERS = { cook: "Cook Political Report", inside: "Inside Elections", sabato: "Sabato's Crystal Ball" } as const;

// ---------- statewide races ----------

export interface StatewideRace {
  meta: RaceMeta;
  /** "Senate race", "Senate special election", "governor's race". */
  noun: string;
  /** Short label for descriptions: "Senate", "Senate special", "Governor". */
  short: string;
}

export function statewideRaces(races: RaceMeta[]): StatewideRace[] {
  const out: StatewideRace[] = [];
  const senate = races.find((r) => r.office === "senate" && !r.special);
  const special = races.find((r) => r.office === "senate" && r.special);
  const governor = races.find((r) => r.office === "governor");
  if (senate) out.push({ meta: senate, noun: "Senate race", short: "Senate" });
  if (special) out.push({ meta: special, noun: "Senate special election", short: "Senate special" });
  if (governor) out.push({ meta: governor, noun: "governor's race", short: "Governor" });
  return out;
}

/** "Jane Roe (D) vs John Doe (R)" when the race has exactly one candidate from each major party. */
export function matchup(meta: RaceMeta): string | undefined {
  const d = meta.candidates.filter((c) => c.party === "D");
  const r = meta.candidates.filter((c) => c.party === "R");
  return d.length === 1 && r.length === 1 ? `${d[0].name} (D) vs ${r[0].name} (R)` : undefined;
}

export function candidatesText(meta: RaceMeta): string | undefined {
  if (!meta.candidates.length) return undefined;
  const order = (p: Party) => (p === "D" ? 0 : p === "R" ? 1 : 2);
  const list = [...meta.candidates]
    .sort((a, b) => order(a.party) - order(b.party))
    .map((c) => `${c.name} (${c.party}${c.incumbent ? ", incumbent" : ""})`);
  return `Candidates: ${list.join(", ")}.`;
}

export function ratingText(meta: RaceMeta): string | undefined {
  const c = meta.ratings.consensus;
  if (!c) return undefined;
  const others = (Object.keys(RATERS) as (keyof typeof RATERS)[])
    .filter((k) => meta.ratings[k])
    .map((k) => `${RATERS[k]}: ${ratingLabel[meta.ratings[k]!]}`);
  const asOf = shortDate(meta.ratings.asOf);
  return `The consensus rating is ${ratingLabel[c]}${others.length ? ` (${others.join("; ")})` : ""}${asOf ? `, as of ${asOf}` : ""}.`;
}

export function pollText(meta: RaceMeta): string | undefined {
  const p = meta.polls;
  if (!p) return undefined;
  const date = shortDate(p.asOf);
  return `The poll average is ${fmtMarginDR(p.d - p.r)} (D ${p.d.toFixed(1)}%, R ${p.r.toFixed(1)}%; ${p.n} polls${date ? ` through ${date}` : ""}).`;
}

// ---------- history ----------

export interface LastWins {
  d?: { year: number; margin: number };
  r?: { year: number; margin: number };
  first: number;
  last: number;
  dWins: number;
  rWins: number;
  total: number;
}

/** Most recent Democratic and Republican winning years in a D-R margin series. */
export function lastWins(series: MarginSeries | undefined): LastWins | undefined {
  const years = Object.keys(series ?? {})
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!series || !years.length) return undefined;
  const out: LastWins = { first: years[0], last: years[years.length - 1], dWins: 0, rWins: 0, total: years.length };
  for (const y of years) {
    const m = series[String(y)];
    if (m > 0) {
      out.dWins++;
      out.d = { year: y, margin: m };
    } else if (m < 0) {
      out.rWins++;
      out.r = { year: y, margin: m };
    }
  }
  return out;
}

const SIDE = { d: "Democratic", r: "Republican" } as const;

/** Asks about the party that did not win the latest election, so the answer is the more interesting one. */
function askedParty(w: LastWins): "d" | "r" {
  return w.d?.year === w.last ? "r" : "d";
}

/** "When did X last elect a Democrat ...": Senate and governor series from the Big Board's own (possibly gappy) dataset. */
export function lastWinQa(phrase: (who: string) => string, ansNoun: string, w: LastWins): QA {
  const ask = askedParty(w);
  const other = ask === "d" ? "r" : "d";
  const hit = w[ask];
  const alt = w[other];
  const q = phrase(ask === "d" ? "a Democrat" : "a Republican");
  const twoRaces = ansNoun === "a Senate race" ? " Only the regular election counts when a state holds two Senate races in one year." : "";
  const caveat = `The Big Board's dataset covers ${w.total} elections, ${w.first}–${w.last}, and may have gaps.${twoRaces}`;
  if (!hit) {
    return { q, a: `No ${SIDE[ask]} candidate won ${ansNoun} in the dataset.${alt ? ` The last ${SIDE[other]} win was ${alt.year} (${fmtMarginDR(alt.margin)}).` : ""} ${caveat}` };
  }
  return {
    q,
    a: `The last ${SIDE[ask]} win was ${hit.year} (${fmtMarginDR(hit.margin)})${alt ? `, and the last ${SIDE[other]} win was ${alt.year} (${fmtMarginDR(alt.margin)})` : ""}. ${caveat}`,
  };
}

// ---------- poll-close and reporting-order text ----------

const overnight = (hhmm: string) => Number(hhmm.split(":")[0]) < 6;

export function closeTimesText(state: StateContentInput["state"]): string {
  const parts = state.pollCloseEt.split("/");
  const lo = parts[0];
  const hi = parts[parts.length - 1];
  const late = overnight(lo) ? ", after midnight on Wednesday, November 4" : "";
  const src = state.pollCloseSource?.includes("greenpapers") ? " Close times per The Green Papers." : "";
  if (lo === hi) return `Polls in ${state.name} close at ${fmtEt(lo)}${late} on Election Day.${src}`;
  return `Polls in ${state.name} close between ${fmtEt(lo)} and ${fmtEt(hi)}${late}, depending on the part of the state.${src}`;
}

function orderText(state: StateContentInput["state"]): string {
  const note = state.voteOrderNote ? ` ${state.voteOrderNote}` : "";
  switch (state.voteOrder) {
    case "early-first":
      return `${state.name} reports early and mail ballots first, so early returns can lean Democratic until Election Day votes are counted.${note}`;
    case "eday-first":
      return `${state.name} reports Election Day votes first, so early returns can lean Republican until mail ballots are counted.${note}`;
    case "mixed":
      return `Counting order varies by county in ${state.name}, so early numbers are noisy.${note}`;
    default:
      return `The reporting order for ${state.name} has not been confirmed for 2026, so treat early numbers with caution.`;
  }
}

// ---------- ballot / House text ----------

function ballotMeasures(races: RaceMeta[]): string[] {
  return races
    .filter((r) => r.office === "ballot")
    .map((r) => r.name.trim())
    .filter(Boolean);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// ---------- public builders ----------

export function stateTitle(name: string): string {
  return `${name} 2026 Election: Polls, Results & Closing Times`;
}

/** The statewide race to lead with: the first one that has a poll average, else the first one. */
function leadRace(races: RaceMeta[]): StatewideRace | undefined {
  return statewideRaces(races)
    .sort((a, b) => Number(!!b.meta.polls) - Number(!!a.meta.polls))
    .at(0);
}

/** Up to three short lines for the share card: the lead race, its rating and poll average, and the history sentence. */
export function stateCardLines({ races, row }: StateContentInput): string[] {
  const lead = leadRace(races);
  const lines: string[] = [];
  if (lead) {
    const rating = lead.meta.ratings.consensus;
    const poll = lead.meta.polls;
    const m = matchup(lead.meta);
    const detail = [rating ? `rated ${ratingLabel[rating]}` : "", poll ? `poll average ${fmtMarginDR(poll.d - poll.r)}` : ""].filter(Boolean).join(", ");
    if (m) {
      lines.push(`${lead.short}: ${m}`);
      if (detail) lines.push(`${detail[0].toUpperCase()}${detail.slice(1)}`);
    } else if (detail) {
      lines.push(`${lead.short} race: ${detail}`);
    }
  }
  if (row?.projection) lines.push(lastTimeSentence(row, "pres"));
  return lines;
}

export function stateDescription({ state, races, row }: StateContentInput): string {
  const lead = leadRace(races);
  const bits: string[] = [];
  let led = false;
  if (lead) {
    const m = matchup(lead.meta);
    const rating = lead.meta.ratings.consensus;
    const poll = lead.meta.polls;
    const date = shortDate(poll?.asOf);
    const detail = [m ?? "", rating ? `rated ${ratingLabel[rating]}` : "", poll ? `poll average ${fmtMarginDR(poll.d - poll.r)}${date ? ` (${date})` : ""}` : ""].filter(Boolean);
    if (detail.length) {
      bits.push(`${state.name} 2026 ${lead.noun}: ${detail.join(", ")}.`);
      led = true;
    }
  }
  const p = row?.projection;
  if (p && row.lastTime !== undefined && row.lastTime !== row.latestYear) {
    bits.push(`Polls point to ${fmtMarginDR(p.margin)}. ${state.name} last voted this ${p.margin >= 0 ? "Democratic" : "Republican"} in ${row.lastTime}.`);
  }
  if (!bits.length) {
    const houseN = races.filter((r) => r.office === "house").length;
    bits.push(`${houseN ? `${houseN} U.S. House ${houseN === 1 ? "seat" : "seats"}, ` : ""}ballot measures, county results and presidential history.`);
  }
  bits.push("Poll closing times and counting order.");
  return led ? bits.join(" ") : `${state.name} 2026: ${bits.join(" ")}`;
}

/** The long-tail question block for a state page. Every answer is built from the reference data. */
export function stateQa(input: StateContentInput): QA[] {
  const { state, races, history, row } = input;
  const name = state.name;
  const qa: QA[] = [];

  qa.push({ q: `What time do polls close in ${name} on Election Day 2026?`, a: `${closeTimesText(state)} For every state, see [poll closing times](/election-night).` });

  qa.push({
    q: `When will ${name} election results be known?`,
    a: `Election Day is ${ELECTION_DAY_LABEL}. ${closeTimesText(state).replace(/ Close times per The Green Papers\.$/, "")} ${orderText(state)} Official results arrive after polls close. The Big Board shows its own projection and does not call races. For why early totals shift, read [blue and red mirages](/explainers#mirage).`,
  });

  for (const w of statewideRaces(races)) {
    const m = matchup(w.meta);
    const held = w.meta.heldBy ? `The seat is held by a ${partyName[w.meta.heldBy]}.` : undefined;
    const a = [
      m ? `The matchup is ${m}.` : candidatesText(w.meta),
      ratingText(w.meta),
      pollText(w.meta),
      held,
      `The Big Board shows polls and ratings but does not call races. Read [how ratings work](/explainers#ratings), or see the [${name} ${w.short} race](${raceHref(w.meta.id)}).`,
    ]
      .filter(Boolean)
      .join(" ");
    qa.push({ q: `Who is favored to win the ${name} ${w.noun} in 2026?`, a });
  }

  const pres = lastWins(history?.pres);
  if (pres) {
    qa.push(presidentialQa(name, pres));
    qa.push(redBlueQa(name, history!.pres, pres));
  }

  if (row?.projection) {
    qa.push({ q: `When was the last time ${name} voted the way 2026 polls point?`, a: lastTimeSentence(row, "pres") });
  }

  const sen = lastWins(history?.senate);
  if (sen && sen.total >= 6) qa.push(lastWinQa((who) => `When did ${name} last elect ${who} to the U.S. Senate?`, "a Senate race", sen));
  const gov = lastWins(history?.governor);
  if (gov && gov.total >= 6) qa.push(lastWinQa((who) => `When did ${name} last elect ${who} as governor?`, "the governor's race", gov));

  const house = races.filter((r) => r.office === "house").length;
  if (house && state.abbr !== "DC") {
    qa.push({
      q: `How many U.S. House districts does ${name} have in 2026?`,
      a: house === 1 ? `${name} has one at-large U.S. House seat on the 2026 ballot.` : `${name} elects ${house} U.S. House members in 2026, one per district, and all ${house} seats are on the ballot.`,
    });
  }

  const measures = ballotMeasures(races);
  if (measures.length) {
    const shown = measures.slice(0, 6).map((m) => clip(m, 140));
    qa.push({
      q: `What ballot measures are on the ${name} ballot in 2026?`,
      a: `The Big Board tracks ${measures.length} statewide ${measures.length === 1 ? "measure" : "measures"}: ${shown.join("; ")}${measures.length > shown.length ? `; and ${measures.length - shown.length} more` : ""}.`,
    });
  }

  if (races.some((r) => r.runoffRule === "majority" && r.office !== "ballot")) {
    qa.push({
      q: `Is there a runoff in ${name} if no candidate wins a majority?`,
      a: `Yes. ${name} requires a majority in its general elections for Senate, governor and U.S. House. A race where no candidate wins more than 50% goes to a runoff between the top two.`,
    });
  }

  return qa;
}

function presidentialQa(name: string, w: LastWins): QA {
  const ask = askedParty(w);
  const other = ask === "d" ? "r" : "d";
  const hit = w[ask];
  const alt = w[other];
  const q = `When did ${name} last vote for a ${ask === "d" ? "Democrat" : "Republican"} for president?`;
  if (!hit) {
    return { q, a: `${name} has not voted for a ${SIDE[ask]} presidential candidate in any of the ${w.total} elections from ${w.first} to ${w.last}.${alt ? ` Its last ${SIDE[other]} vote was ${alt.year} (${fmtMarginDR(alt.margin)}).` : ""}` };
  }
  return {
    q,
    a: `${name} last voted for a ${SIDE[ask]} presidential candidate in ${hit.year} (${fmtMarginDR(hit.margin)})${alt ? ` and for a ${SIDE[other]} in ${alt.year} (${fmtMarginDR(alt.margin)})` : ""}. Margins run D minus R across ${w.total} elections, ${w.first}–${w.last}. Compare every state in [Flashback](/history).`,
  };
}

function redBlueQa(name: string, series: MarginSeries, w: LastWins): QA {
  const latest = series[String(w.last)];
  const prior = Object.keys(series)
    .map(Number)
    .sort((a, b) => b - a)[1];
  const priorText = prior !== undefined ? ` and ${series[String(prior)] > 0 ? "Democratic" : "Republican"} in ${prior} (${fmtMarginDR(series[String(prior)])})` : "";
  const narrowest = Object.entries(series).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
  return {
    q: `Is ${name} a red state or a blue state?`,
    a: `${name} voted ${latest > 0 ? "Democratic" : "Republican"} in ${w.last} (${fmtMarginDR(latest)})${priorText}. Of the ${w.total} presidential elections from ${w.first} to ${w.last}, Democrats carried it ${w.dWins} ${w.dWins === 1 ? "time" : "times"} and Republicans ${w.rWins}. The narrowest margin came in ${narrowest[0]} (${fmtMarginDR(narrowest[1])}).`,
  };
}
