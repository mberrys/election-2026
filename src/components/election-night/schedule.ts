import type { RaceMeta, RatingCode, StateMeta } from "@/data/schema";
import { fmtEt, ratingLabel } from "@/lib/format";

/** Ratings at Lean or closer: the races worth watching on the night. */
export const WATCH_RATINGS: ReadonlySet<RatingCode> = new Set(["lean-d", "tilt-d", "tossup", "tilt-r", "lean-r"]);

export interface WatchRace {
  label: string;
  rating: string;
}

export interface ScheduleState {
  abbr: string;
  name: string;
  /** Closing time of the first part of the state. */
  firstClose: string;
  /** Later closing time when the state spans time zones. */
  laterClose?: string;
  races: WatchRace[];
  houseSeats: number;
  competitiveHouse: number;
}

export interface ScheduleGroup {
  /** Earliest closing time, "HH:MM" ET. */
  key: string;
  label: string;
  /** After midnight ET, so Wednesday morning. */
  overnight: boolean;
  states: ScheduleState[];
  competitiveHouse: number;
}

const hour = (hhmm: string) => Number(hhmm.split(":")[0]);
const sortKey = (hhmm: string) => (hour(hhmm) < 6 ? hour(hhmm) + 24 : hour(hhmm)) * 60 + Number(hhmm.split(":")[1]);

function statewide(races: RaceMeta[]): WatchRace[] {
  const out: WatchRace[] = [];
  for (const r of races) {
    const rating = r.ratings.consensus;
    if (!rating || !WATCH_RATINGS.has(rating)) continue;
    if (r.office === "senate") out.push({ label: r.special ? "Senate special" : "Senate", rating: ratingLabel[rating] });
    else if (r.office === "governor") out.push({ label: "Governor", rating: ratingLabel[rating] });
  }
  return out;
}

/** Every state grouped by the hour its polls first close (ET), with the Senate, governor and House races to watch. */
export function buildSchedule(states: StateMeta[], races: RaceMeta[]): ScheduleGroup[] {
  const byState = new Map<string, RaceMeta[]>();
  for (const r of races) (byState.get(r.state) ?? byState.set(r.state, []).get(r.state)!).push(r);

  const groups = new Map<string, ScheduleState[]>();
  for (const s of states) {
    const parts = s.pollCloseEt.split("/");
    const lo = parts[0];
    const hi = parts[parts.length - 1];
    const rs = byState.get(s.abbr) ?? [];
    const house = rs.filter((r) => r.office === "house");
    const entry: ScheduleState = {
      abbr: s.abbr,
      name: s.name,
      firstClose: fmtEt(lo),
      laterClose: hi !== lo ? fmtEt(hi) : undefined,
      races: statewide(rs),
      houseSeats: house.length,
      competitiveHouse: house.filter((r) => r.ratings.consensus && WATCH_RATINGS.has(r.ratings.consensus)).length,
    };
    (groups.get(lo) ?? groups.set(lo, []).get(lo)!).push(entry);
  }

  return [...groups.entries()]
    .sort((a, b) => sortKey(a[0]) - sortKey(b[0]))
    .map(([key, list]) => ({
      key,
      label: fmtEt(key),
      overnight: hour(key) < 6,
      states: list.sort((a, b) => a.name.localeCompare(b.name)),
      competitiveHouse: list.reduce((n, s) => n + s.competitiveHouse, 0),
    }));
}

export interface ReportingOrder {
  earlyFirst: StateMeta[];
  edayFirst: StateMeta[];
  mixed: StateMeta[];
}

/** States with a documented vote-counting order; states marked "unknown" are left out. */
export function reportingOrder(states: StateMeta[]): ReportingOrder {
  const pick = (o: StateMeta["voteOrder"]) => states.filter((s) => s.voteOrder === o);
  return { earlyFirst: pick("early-first"), edayFirst: pick("eday-first"), mixed: pick("mixed") };
}
