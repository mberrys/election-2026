/**
 * Client-side chamber math shared by the Senate and Governors boards.
 *
 * Unlike analytics/computeBalance (which walks the live snapshot), these helpers walk the reference
 * metas so every race on the ballot counts as "leaning" until a live row projects it. That keeps the
 * balance bar, the race table and the path-to-majority panel consistent pre-election, when the live
 * payload is empty.
 */
import { CHAMBER, calledParty, emptyCount, partyBucket, ratingLean, type BopOffice } from "@/analytics";
import type { BalanceOfPower, Party, PartyCount, Race, RaceMeta, RatingCode } from "@/data/schema";

export type LiveRace = Omit<Race, "units">;
export type LiveIndex = ReadonlyMap<string, LiveRace>;

export const EMPTY_LIVE: LiveIndex = new Map();

export function buildBalance(
  office: BopOffice,
  metas: readonly RaceMeta[],
  live: LiveIndex,
  notUp: PartyCount = emptyCount(),
): BalanceOfPower {
  const called = emptyCount();
  const leaning = emptyCount();
  let tossup = 0;
  const raceIds = { calledD: [] as string[], calledR: [] as string[], calledI: [] as string[], uncalled: [] as string[] };

  for (const m of metas) {
    const race = live.get(m.id);
    const winner = race ? calledParty(race) : undefined;
    if (winner) {
      const b = partyBucket(winner);
      called[b] += 1;
      (b === "D" ? raceIds.calledD : b === "R" ? raceIds.calledR : raceIds.calledI).push(m.id);
      continue;
    }
    raceIds.uncalled.push(m.id);
    const lean = ratingLean(m.ratings.consensus);
    if (lean === "tossup") tossup += 1;
    else leaning[partyBucket(lean)] += 1;
  }

  const { total, majority } = CHAMBER[office];
  return { office, total, majority, notUp: { ...notUp }, called, leaning, tossup, raceIds };
}

/** Seats on the board for each side: not up + won + leaning (what the big numbers show). */
export function seatTotals(bop: BalanceOfPower) {
  const d = bop.notUp.D + bop.notUp.I + bop.called.D + bop.called.I + bop.leaning.D + bop.leaning.I;
  const r = bop.notUp.R + bop.called.R + bop.leaning.R;
  return { d, r };
}

/** Seats locked in for each side: not up + won. */
export function seatsWon(bop: BalanceOfPower) {
  return { d: bop.notUp.D + bop.notUp.I + bop.called.D + bop.called.I, r: bop.notUp.R + bop.called.R };
}

export function isCalled(race: LiveRace | undefined): boolean {
  return !!race && (race.status === "projected" || race.status === "certified");
}

/** Party that has flipped the seat (projection differs from the holder), else undefined. */
export function flippedTo(meta: RaceMeta, race: LiveRace | undefined): Party | undefined {
  const winner = race ? calledParty(race) : undefined;
  if (!winner || !meta.heldBy) return undefined;
  return winner !== meta.heldBy ? winner : undefined;
}

const COMPETITIVE = new Set<RatingCode>(["lean-d", "tilt-d", "tossup", "tilt-r", "lean-r"]);

/** Lean, tilt or toss-up, or unrated: races where a missing poll is itself worth saying. */
export function isCompetitive(rating: RatingCode | undefined): boolean {
  return !rating || COMPETITIVE.has(rating);
}

/** The race has produced something to show: votes, a call, or a runoff. Before that, live columns stay hidden. */
export function hasResults(race: LiveRace | undefined): boolean {
  return !!race && (race.totalVotes > 0 || isCalled(race) || race.status === "runoff");
}

/** A seat that could change hands: competitive rating, rating leaning away from the holder, or already flipped. */
export function flipPossible(meta: RaceMeta, race: LiveRace | undefined): boolean {
  if (isCalled(race)) return flippedTo(meta, race) !== undefined;
  const rating = meta.ratings.consensus;
  if (!rating) return true;
  if (COMPETITIVE.has(rating)) return true;
  const lean = ratingLean(rating);
  return !meta.heldBy || lean !== meta.heldBy;
}

/** Name colour: the two major parties carry their ink; everyone else stays plain. */
export function partyInk(party: Party | undefined): string | undefined {
  return party === "D" ? "text-party-d-ink" : party === "R" ? "text-party-r-ink" : undefined;
}

export function pollMargin(meta: RaceMeta): number | undefined {
  return meta.polls ? meta.polls.d - meta.polls.r : undefined;
}

/** Winner (or current leader) of a live race by candidate id. */
export function leaderOf(race: LiveRace | undefined): { id: string; party: Party; name: string } | undefined {
  if (!race) return undefined;
  const id = race.projection?.winnerId ?? race.leaderId;
  if (!id) return undefined;
  const c = race.candidates.find((x) => x.id === id);
  return c ? { id: c.id, party: c.party, name: c.name } : undefined;
}

export function stateNameLookup(states: readonly { abbr: string; name: string }[]) {
  const map = new Map(states.map((s) => [s.abbr, s.name]));
  return (abbr: string) => map.get(abbr) ?? abbr;
}
