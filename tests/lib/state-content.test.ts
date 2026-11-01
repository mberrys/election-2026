import { describe, expect, it } from "vitest";
import { closeTimesText, lastWins, matchup, shortDate, stateCardLines, stateDescription, stateQa, stateTitle, type StateContentInput } from "../../src/components/state/state-content";
import { stateContentInput } from "../../src/components/state/state-content-data";
import { loadStates } from "../../src/data/reference/load";
import type { RaceMeta } from "../../src/data/schema";

const race = (over: Partial<RaceMeta> & Pick<RaceMeta, "id" | "office">): RaceMeta =>
  ({ state: "TX", special: false, name: over.id, candidates: [], ratings: {}, baseline: {}, runoffRule: "none", ...over }) as RaceMeta;

const senate = race({
  id: "senate:TX",
  office: "senate",
  candidates: [
    { id: "r", name: "Ray Roe", party: "R", incumbent: false, aliases: [] },
    { id: "d", name: "Dana Doe", party: "D", incumbent: false, aliases: [] },
    { id: "l", name: "Lee Lib", party: "L", incumbent: false, aliases: [] },
  ],
  ratings: { consensus: "tossup", cook: "tossup", inside: "tilt-d", asOf: "2026-10-30" },
  polls: { d: 49, r: 46.5, n: 20, asOf: "2026-10-28", source: "VoteHub" },
  heldBy: "R",
});

const input: StateContentInput = {
  state: { abbr: "TX", name: "Texas", pollCloseEt: "20:00/21:00", pollCloseFirstEt: "20:00", voteOrder: "unknown" },
  races: [senate, race({ id: "house:TX-01", office: "house", district: "01" }), race({ id: "house:TX-02", office: "house", district: "02" })],
  history: {
    pres: { "1976": 3.2, "1980": -14, "2020": -5.6, "2024": -13.7 },
    senate: { "1990": -22.8, "1994": -22.5, "1996": -10.9, "2002": -12, "2006": -25.7, "2018": -2.6 },
    governor: {},
  },
};

describe("shortDate", () => {
  it("formats ISO dates and timestamps in UTC", () => {
    expect(shortDate("2026-10-28")).toBe("Oct 28");
    expect(shortDate("2026-10-31T16:50:26.432Z")).toBe("Oct 31");
    expect(shortDate(undefined)).toBeUndefined();
    expect(shortDate("nope")).toBeUndefined();
  });
});

describe("lastWins", () => {
  it("finds the most recent winning year for each party", () => {
    const w = lastWins({ "1976": 3.2, "1980": -14, "2020": -5.6 })!;
    expect(w.d).toEqual({ year: 1976, margin: 3.2 });
    expect(w.r).toEqual({ year: 2020, margin: -5.6 });
    expect([w.dWins, w.rWins, w.total, w.first, w.last]).toEqual([1, 2, 3, 1976, 2020]);
  });

  it("is undefined for an empty series", () => {
    expect(lastWins({})).toBeUndefined();
    expect(lastWins(undefined)).toBeUndefined();
  });
});

describe("matchup", () => {
  it("names the matchup only when each major party has exactly one candidate", () => {
    expect(matchup(senate)).toBe("Dana Doe (D) vs Ray Roe (R)");
    expect(matchup(race({ id: "x", office: "senate", candidates: [{ id: "a", name: "A", party: "D", incumbent: false, aliases: [] }] }))).toBeUndefined();
  });
});

describe("closeTimesText", () => {
  const base = { abbr: "X", name: "Xland", voteOrder: "unknown" as const };
  it("handles a single, split and after-midnight close", () => {
    expect(closeTimesText({ ...base, pollCloseEt: "19:00" })).toBe("Polls in Xland close at 7 PM ET on Election Day.");
    expect(closeTimesText({ ...base, pollCloseEt: "20:00/21:00" })).toBe("Polls in Xland close between 8 PM ET and 9 PM ET, depending on the part of the state.");
    expect(closeTimesText({ ...base, pollCloseEt: "00:00/01:00" })).toContain("after midnight on Wednesday, November 4");
  });
});

describe("stateQa", () => {
  const qa = stateQa(input);
  const answer = (q: RegExp) => qa.find((x) => q.test(x.q))?.a ?? "";

  it("answers poll close, favorite, last Democratic presidential vote and House size", () => {
    expect(answer(/What time do polls close in Texas/)).toContain("between 8 PM ET and 9 PM ET");
    const fav = answer(/Who is favored.*Senate race/);
    expect(fav).toContain("Dana Doe (D) vs Ray Roe (R)");
    expect(fav).toContain("Toss-up");
    expect(fav).toContain("D+2.5");
    expect(answer(/last vote for a Democrat for president/)).toContain("1976 (D+3.2)");
    expect(answer(/How many U.S. House districts/)).toContain("2 U.S. House members");
  });

  it("says plainly when a party has not won in the dataset", () => {
    const a = answer(/last elect a Democrat to the U.S. Senate/);
    expect(a).toContain("No Democratic candidate won a Senate race");
    expect(a).toContain("may have gaps");
  });

  it("skips Senate and governor history that is too thin, and runoffs unless the state has them", () => {
    expect(qa.some((x) => /as governor/.test(x.q))).toBe(false);
    expect(qa.some((x) => /runoff/.test(x.q))).toBe(false);
    const ga = stateQa({ ...input, races: [race({ id: "senate:GA", office: "senate", runoffRule: "majority" })] });
    expect(ga.some((x) => /runoff/.test(x.q))).toBe(true);
  });

  it("describes counting order only as far as it is documented", () => {
    expect(answer(/When will Texas election results be known/)).toContain("has not been confirmed");
    const wi = stateQa({ ...input, state: { ...input.state, voteOrder: "eday-first", voteOrderNote: "Milwaukee reports late." } });
    expect(wi.find((x) => /results be known/.test(x.q))!.a).toContain("Election Day votes first");
    expect(wi.find((x) => /results be known/.test(x.q))!.a).toContain("Milwaukee reports late.");
  });
});

describe("title, description and card lines", () => {
  it("leads the description with the matchup, rating and poll average", () => {
    const d = stateDescription(input);
    expect(d).toMatch(/^Texas 2026 Senate race: Dana Doe \(D\) vs Ray Roe \(R\), rated Toss-up, poll average D\+2\.5 \(Oct 28\)\./);
    expect(stateDescription({ ...input, races: [] })).toMatch(/^Texas 2026: /);
    expect(stateTitle("Texas")).toContain("Texas 2026 Election");
  });

  it("gives the share card up to three lines", () => {
    expect(stateCardLines(input)).toEqual(["Senate: Dana Doe (D) vs Ray Roe (R)", "Rated Toss-up, poll average D+2.5"]);
    const noMatchup = { ...input, races: [{ ...senate, candidates: [] }] };
    expect(stateCardLines(noMatchup)).toEqual(["Senate race: rated Toss-up, poll average D+2.5"]);
  });
});

describe("every state", () => {
  const states = loadStates();

  it("builds a non-empty, clean question block, description and card for all of them", () => {
    expect(states).toHaveLength(51);
    for (const s of states) {
      const real = stateContentInput(s.abbr)!;
      const qa = stateQa(real);
      const text = [stateDescription(real), ...qa.flatMap((x) => [x.q, x.a])].join("\n");
      expect(qa.length, s.abbr).toBeGreaterThanOrEqual(4);
      expect(text, s.abbr).not.toMatch(/undefined|NaN|null|\[object/);
      expect(new Set(qa.map((x) => x.q)).size, s.abbr).toBe(qa.length);
      expect(stateDescription(real).length, s.abbr).toBeLessThanOrEqual(300);
    }
  });
});
