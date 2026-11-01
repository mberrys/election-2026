import type { Office, RaceMeta } from "@/data/schema";
import { WATCH_RATINGS } from "@/components/election-night/schedule";

export interface OfficeTally {
  total: number;
  tossups: number;
  /** Rated Lean or closer, Toss-ups included. */
  watch: number;
}

export function officeTally(races: RaceMeta[], office: Office): OfficeTally {
  const of = races.filter((r) => r.office === office);
  return {
    total: of.length,
    tossups: of.filter((r) => r.ratings.consensus === "tossup").length,
    watch: of.filter((r) => r.ratings.consensus && WATCH_RATINGS.has(r.ratings.consensus)).length,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Meta descriptions for the national pages, with this build's rating counts in them. */
export function nationalCopy(races: RaceMeta[]) {
  const s = officeTally(races, "senate");
  const h = officeTally(races, "house");
  const g = officeTally(races, "governor");
  return {
    home: `Live tracker for the Nov 3, 2026 midterms: ${s.total} Senate races (${plural(s.tossups, "Toss-up")}), ${h.total} House seats (${plural(h.tossups, "Toss-up")}) and ${g.total} governorships (${plural(g.tossups, "Toss-up")}). Polls, ratings and county-level results.`,
    senate: `${s.total} Senate seats are on the 2026 ballot: ${s.tossups} rated Toss-up and ${s.watch} Lean or closer. Ratings, poll averages, paths to a majority and live results.`,
    house: `All ${h.total} U.S. House seats are up in 2026: ${h.tossups} rated Toss-up and ${h.watch} Lean or closer. Poll averages, poll closing times and live results.`,
    governors: `${g.total} governor races in 2026: ${g.tossups} rated Toss-up and ${g.watch} Lean or closer. Ratings, poll averages, money and live results.`,
  };
}
