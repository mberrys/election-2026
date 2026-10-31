import { describe, expect, it } from "vitest";
import {
  CHAMBER,
  SENATE_NOT_UP_2026,
  computeBalance,
  pathsToMajority,
  seatsNeeded,
} from "../../src/analytics/balanceOfPower";
import type { Race, RaceMeta, RatingCode } from "../../src/data/schema";

const src = { adapter: "test", tier: "A" as const, fetchedAt: "t" };

function race(id: string, state: string, status: Race["status"], over: Partial<Race> = {}): Race {
  return {
    id,
    office: "senate",
    state,
    special: false,
    name: id,
    candidates: [
      { id: "d", name: "D", party: "D", votes: 0, pct: 0 },
      { id: "r", name: "R", party: "R", votes: 0, pct: 0 },
    ],
    totalVotes: 0,
    status,
    units: [],
    source: src,
    updatedAt: "t",
    ...over,
  };
}

function meta(id: string, consensus?: RatingCode): RaceMeta {
  return {
    id,
    office: "senate",
    state: id.slice(-2),
    special: false,
    name: id,
    candidates: [],
    ratings: consensus ? { consensus } : {},
    baseline: {},
    runoffRule: "none",
  };
}

describe("computeBalance", () => {
  const races: Race[] = [
    race("senate:GA", "GA", "projected", {
      projection: { winnerId: "d", party: "D", by: "bigboard", at: "t", marginPts: 3, band: 1 },
    }),
    race("senate:OH", "OH", "certified", {
      candidates: [
        { id: "d", name: "D", party: "D", votes: 40, pct: 40 },
        { id: "r", name: "R", party: "R", votes: 60, pct: 60 },
      ],
      totalVotes: 100,
    }),
    race("senate:NC", "NC", "counting"),
    race("senate:MI", "MI", "counting"),
    race("senate:TX", "TX", "not_started"),
    race("senate:ME", "ME", "counting", {
      projection: { winnerId: "i", party: "I", by: "bigboard", at: "t", marginPts: 3, band: 1 },
      status: "projected",
    }),
    race("governor:MI", "MI", "counting", { office: "governor" }),
  ];
  const metas = [meta("senate:NC", "tossup"), meta("senate:MI", "lean-d"), meta("senate:TX", "likely-r")];

  it("buckets called, leaning and tossup races and ignores other offices", () => {
    const b = computeBalance("senate", races, metas, SENATE_NOT_UP_2026);
    expect(b.office).toBe("senate");
    expect(b.total).toBe(100);
    expect(b.majority).toBe(51);
    expect(b.notUp).toEqual({ D: 32, R: 31, I: 2 });
    expect(b.called).toEqual({ D: 1, R: 1, I: 1 });
    expect(b.leaning).toEqual({ D: 1, R: 1, I: 0 });
    expect(b.tossup).toBe(1);
    expect(b.raceIds).toEqual({
      calledD: ["senate:GA"],
      calledR: ["senate:OH"],
      calledI: ["senate:ME"],
      uncalled: ["senate:NC", "senate:MI", "senate:TX"],
    });
  });

  it("treats uncalled races without a rating as tossups", () => {
    const b = computeBalance("senate", [race("senate:AK", "AK", "counting")], []);
    expect(b.tossup).toBe(1);
    expect(b.notUp).toEqual({ D: 0, R: 0, I: 0 });
  });

  it("house and governor chamber constants", () => {
    const h = computeBalance("house", [], []);
    expect([h.total, h.majority]).toEqual([435, 218]);
    const g = computeBalance("governor", races, []);
    expect([g.total, g.majority]).toEqual([36, 0]);
    expect(g.raceIds?.uncalled).toEqual(["governor:MI"]);
    expect(CHAMBER.senate.majority).toBe(51);
  });

  it("does not mutate the notUp argument", () => {
    const notUp = { D: 1, R: 2, I: 3 };
    const b = computeBalance("senate", [], [], notUp);
    expect(b.notUp).not.toBe(notUp);
    expect(b.notUp).toEqual(notUp);
  });
});

describe("pathsToMajority", () => {
  const balance = {
    ...computeBalance("senate", [], [], { D: 32, R: 31, I: 2 }),
    called: { D: 14, R: 17, I: 0 },
  };
  const uncalled = [
    { id: "senate:NC", rating: "tossup" as const },
    { id: "senate:ME", rating: "lean-d" as const },
    { id: "senate:TX", rating: "likely-r" as const },
    { id: "senate:OH", rating: "lean-r" as const },
    { id: "senate:MI", rating: "tilt-d" as const },
  ];

  it("independents caucus with D by default; both parties need 3 of 5", () => {
    const p = pathsToMajority(balance, uncalled);
    expect(p.D.have).toBe(48);
    expect(p.D.need).toBe(3);
    expect(p.D.path).toEqual(["senate:ME", "senate:MI", "senate:NC"]);
    expect(p.D.mustWinNonLeaning).toBe(1);
    expect(p.D.feasible).toBe(true);
    expect(p.R.have).toBe(48);
    expect(p.R.path).toEqual(["senate:TX", "senate:OH", "senate:NC"]);
    expect(p.R.mustWinNonLeaning).toBe(1);
  });

  it("VP tie-break lowers the target to 50 for that party", () => {
    const p = pathsToMajority(balance, uncalled, { vpParty: "R" });
    expect(p.R.target).toBe(50);
    expect(p.R.need).toBe(2);
    expect(p.R.path).toEqual(["senate:TX", "senate:OH"]);
    expect(p.R.mustWinNonLeaning).toBe(0);
    expect(p.D.target).toBe(51);
    expect(seatsNeeded(balance, "R", { vpParty: "R" })).toBe(2);
    expect(seatsNeeded(balance, "D")).toBe(3);
  });

  it("flags infeasible paths", () => {
    const p = pathsToMajority(balance, uncalled.slice(0, 2));
    expect(p.D.feasible).toBe(false);
    expect(p.D.path).toHaveLength(2);
  });

  it("independents can be excluded", () => {
    const p = pathsToMajority(balance, uncalled, { independentsCaucusWith: null });
    expect(p.D.have).toBe(46);
    expect(p.D.need).toBe(5);
  });
});
