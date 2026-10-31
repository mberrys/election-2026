/**
 * Balance of power: called seats (from Big Board projections / certified results), leaning seats
 * (consensus rating of uncalled races), tossups, and Senate paths to a majority.
 *
 * Chamber constants:
 *   senate   total 100, majority 51. Control nuance: 50 seats + the Vice President's tie-breaking
 *            vote also controls the chamber; see SENATE_CONTROL_WITH_VP and seatsNeeded({vpParty}).
 *   house    total 435, majority 218.
 *   governor 36 seats up in 2026, no majority concept (majority 0).
 *
 * Independents are bucketed under "I" (L/G/O map there too). pathsToMajority lets the caller
 * say which caucus the I seats count toward (default D: King and Sanders caucus with Democrats).
 */
import {
  RATING_LEAN,
  RATING_ORDER,
  type BalanceOfPower,
  type Party,
  type PartyCount,
  type Race,
  type RaceMeta,
  type RatingCode,
} from "../data/schema";

export type BopOffice = BalanceOfPower["office"];

/**
 * Senate seats NOT on the 2026 ballot (Classes 1 and 3). 65 seats in total.
 * TODO-verify before launch: confirm the D/R/I split after specials (OH, FL) are accounted for
 * as "up" and that no appointment/vacancy has shifted a class-1/3 seat.
 */
// 2026: 35 seats up (33 Class II + OH, FL specials): 22 R, 13 D. Chamber 53R/45D/2I → not up = 31 R, 32 D, 2 I (King, Sanders).
export const SENATE_NOT_UP_2026: PartyCount = { D: 32, R: 31, I: 2 };

export const SENATE_CONTROL_WITH_VP = 50;

export const CHAMBER: Record<BopOffice, { total: number; majority: number }> = {
  senate: { total: 100, majority: 51 },
  house: { total: 435, majority: 218 },
  governor: { total: 36, majority: 0 },
};

export function partyBucket(party: Party): keyof PartyCount {
  return party === "D" || party === "R" ? party : "I";
}

/** Party that has won the race per our status, or undefined if uncalled. */
export function calledParty(race: Pick<Race, "status" | "projection" | "candidates">): Party | undefined {
  if (race.projection && (race.status === "projected" || race.status === "certified")) {
    return race.projection.party;
  }
  if (race.status === "certified") {
    const leader = [...race.candidates].sort((a, b) => b.votes - a.votes)[0];
    return leader?.party;
  }
  return undefined;
}

export function emptyCount(): PartyCount {
  return { D: 0, R: 0, I: 0 };
}

export function computeBalance(
  office: BopOffice,
  races: ReadonlyArray<Race>,
  metas: ReadonlyArray<RaceMeta>,
  notUp: PartyCount = emptyCount(),
): BalanceOfPower {
  const metaById = new Map(metas.map((m) => [m.id, m]));
  const called = emptyCount();
  const leaning = emptyCount();
  let tossup = 0;
  const raceIds = { calledD: [] as string[], calledR: [] as string[], calledI: [] as string[], uncalled: [] as string[] };

  // Walk every seat on the ballot: reference metas first (so seats with no live feed still count by rating),
  // then any live race without a meta. Live results override the rating where present.
  const liveById = new Map(races.filter((r) => r.office === office).map((r) => [r.id, r]));
  const ids = [
    ...metas.filter((m) => m.office === office).map((m) => m.id),
    ...[...liveById.keys()].filter((id) => !metaById.has(id)),
  ];

  for (const id of ids) {
    const race = liveById.get(id);
    const winner = race ? calledParty(race) : undefined;
    if (!race) {
      raceIds.uncalled.push(id);
      const rating = metaById.get(id)?.ratings.consensus;
      const lean = rating ? RATING_LEAN[rating] : "tossup";
      if (lean === "tossup") tossup += 1;
      else leaning[partyBucket(lean)] += 1;
      continue;
    }
    if (winner) {
      const b = partyBucket(winner);
      called[b] += 1;
      if (b === "D") raceIds.calledD.push(race.id);
      else if (b === "R") raceIds.calledR.push(race.id);
      else raceIds.calledI.push(race.id);
      continue;
    }
    raceIds.uncalled.push(race.id);
    const rating = metaById.get(race.id)?.ratings.consensus;
    const lean = rating ? RATING_LEAN[rating] : "tossup";
    if (lean === "tossup") tossup += 1;
    else leaning[partyBucket(lean)] += 1;
  }

  const { total, majority } = CHAMBER[office];
  return { office, total, majority, notUp: { ...notUp }, called, leaning, tossup, raceIds };
}

export interface SeatsOptions {
  /** Party holding the Vice Presidency; that party controls the Senate at 50 seats. */
  vpParty?: "D" | "R";
  /** Caucus the I seats (notUp + called) count toward. Default "D". null = neither. */
  independentsCaucusWith?: "D" | "R" | null;
}

/** Seats a party already has (notUp + called, plus caucusing independents). */
export function seatsHeld(balance: BalanceOfPower, party: "D" | "R", opts: SeatsOptions = {}): number {
  const caucus = opts.independentsCaucusWith === undefined ? "D" : opts.independentsCaucusWith;
  const ind = caucus === party ? balance.notUp.I + balance.called.I : 0;
  return balance.notUp[party] + balance.called[party] + ind;
}

/** Seat count a party must reach to control the chamber. */
export function controlTarget(balance: BalanceOfPower, party: "D" | "R", opts: SeatsOptions = {}): number {
  if (balance.office === "senate" && opts.vpParty === party) return SENATE_CONTROL_WITH_VP;
  return balance.majority;
}

export function seatsNeeded(balance: BalanceOfPower, party: "D" | "R", opts: SeatsOptions = {}): number {
  return Math.max(0, controlTarget(balance, party, opts) - seatsHeld(balance, party, opts));
}

export interface UncalledRace {
  id: string;
  rating?: RatingCode;
}

export interface PathToMajority {
  party: "D" | "R";
  have: number;
  target: number;
  need: number;
  /** The `need` easiest uncalled races for this party, most favorable first. */
  path: string[];
  /** Races in the path rated tossup or leaning the other way (the "must flip" count). */
  mustWinNonLeaning: number;
  /** False when even sweeping every uncalled race falls short. */
  feasible: boolean;
}

function ratingIndex(r: RatingCode | undefined): number {
  return r ? RATING_ORDER.indexOf(r) : RATING_ORDER.indexOf("tossup");
}

/**
 * For each party: the shortest path to a majority through the uncalled races, ordered from the
 * party's most favorable rating to least. Accepts the uncalled list in any order.
 */
export function pathsToMajority(
  balance: BalanceOfPower,
  uncalled: ReadonlyArray<UncalledRace>,
  opts: SeatsOptions = {},
): { D: PathToMajority; R: PathToMajority } {
  const build = (party: "D" | "R"): PathToMajority => {
    const sorted = [...uncalled].sort((a, b) =>
      party === "D" ? ratingIndex(a.rating) - ratingIndex(b.rating) : ratingIndex(b.rating) - ratingIndex(a.rating),
    );
    const have = seatsHeld(balance, party, opts);
    const target = controlTarget(balance, party, opts);
    const need = Math.max(0, target - have);
    const path = sorted.slice(0, need);
    const mustWinNonLeaning = path.filter((r) => (r.rating ? RATING_LEAN[r.rating] : "tossup") !== party).length;
    return { party, have, target, need, path: path.map((r) => r.id), mustWinNonLeaning, feasible: need <= uncalled.length };
  };
  return { D: build("D"), R: build("R") };
}
