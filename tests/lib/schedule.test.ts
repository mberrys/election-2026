import { describe, expect, it } from "vitest";
import { buildSchedule, reportingOrder } from "../../src/components/election-night/schedule";
import { nationalCopy, officeTally } from "../../src/components/board/page-copy";
import { loadRaces, loadStates } from "../../src/data/reference/load";
import type { RaceMeta, StateMeta } from "../../src/data/schema";

const st = (abbr: string, name: string, pollCloseEt: string, voteOrder: StateMeta["voteOrder"] = "unknown"): StateMeta =>
  ({ abbr, name, fips: "00", pollCloseEt, voteOrder, feeds: [] }) as StateMeta;

const race = (id: string, office: RaceMeta["office"], state: string, consensus?: RaceMeta["ratings"]["consensus"], special = false): RaceMeta =>
  ({ id, office, state, special, name: id, candidates: [], ratings: { consensus }, baseline: {}, runoffRule: "none" }) as RaceMeta;

describe("buildSchedule", () => {
  const states = [st("TX", "Texas", "20:00/21:00"), st("AK", "Alaska", "00:00/01:00"), st("IN", "Indiana", "18:00/19:00"), st("GA", "Georgia", "19:00")];
  const races = [
    race("senate:TX", "senate", "TX", "tossup"),
    race("senate:GA", "senate", "GA", "solid-r"),
    race("governor:GA", "governor", "GA", "lean-d"),
    race("house:TX-01", "house", "TX", "tossup"),
    race("house:TX-02", "house", "TX", "solid-r"),
  ];
  const groups = buildSchedule(states, races);

  it("orders groups by first close with after-midnight states last", () => {
    expect(groups.map((g) => g.key)).toEqual(["18:00", "19:00", "20:00", "00:00"]);
    expect(groups.map((g) => g.overnight)).toEqual([false, false, false, true]);
    expect(groups[0].label).toBe("6 PM ET");
  });

  it("keeps the later close for states that span time zones", () => {
    const tx = groups[2].states[0];
    expect(tx.firstClose).toBe("8 PM ET");
    expect(tx.laterClose).toBe("9 PM ET");
    expect(groups[1].states[0].laterClose).toBeUndefined();
  });

  it("lists only races rated Lean or closer, and counts competitive House seats", () => {
    expect(groups[2].states[0].races).toEqual([{ label: "Senate", rating: "Toss-up" }]);
    expect(groups[2].states[0]).toMatchObject({ houseSeats: 2, competitiveHouse: 1 });
    expect(groups[1].states[0].races).toEqual([{ label: "Governor", rating: "Lean D" }]);
    expect(groups[2].competitiveHouse).toBe(1);
  });

  it("places every real state exactly once", () => {
    const all = buildSchedule(loadStates(), loadRaces());
    const abbrs = all.flatMap((g) => g.states.map((s) => s.abbr));
    expect(abbrs).toHaveLength(51);
    expect(new Set(abbrs).size).toBe(51);
    expect(all[0].key).toBe("18:00");
    expect(all[all.length - 1].overnight).toBe(true);
  });
});

describe("reportingOrder", () => {
  it("groups only the states with a documented order", () => {
    const o = reportingOrder([st("GA", "Georgia", "19:00", "early-first"), st("WI", "Wisconsin", "21:00", "eday-first"), st("PA", "Pennsylvania", "20:00", "mixed"), st("FL", "Florida", "19:00")]);
    expect([o.earlyFirst, o.edayFirst, o.mixed].map((l) => l.map((s) => s.abbr))).toEqual([["GA"], ["WI"], ["PA"]]);
  });
});

describe("page copy", () => {
  it("tallies Toss-ups and Lean-or-closer races per office", () => {
    const races = [race("a", "senate", "TX", "tossup"), race("b", "senate", "GA", "lean-r"), race("c", "senate", "AK", "solid-r"), race("d", "house", "TX", "tossup")];
    expect(officeTally(races, "senate")).toEqual({ total: 3, tossups: 1, watch: 2 });
    expect(officeTally(races, "house")).toEqual({ total: 1, tossups: 1, watch: 1 });
  });

  it("puts this build's counts, but no poll margin, into the descriptions", () => {
    const copy = nationalCopy(loadRaces());
    expect(copy.home).toContain("35 Senate races");
    expect(copy.home).toContain("435 House seats");
    expect(copy.home).not.toContain("Generic ballot");
    expect(copy.senate).toMatch(/^35 Senate seats are on the 2026 ballot: \d+ rated Toss-up/);
    expect(copy.house).not.toContain("Generic ballot");
  });
});
