import { describe, expect, it } from "vitest";
import { callStatus, type CallInput } from "../../src/analytics/callStatus";

const base = (over: Partial<CallInput>): CallInput => ({
  candidates: [
    { id: "a", party: "D", votes: 0 },
    { id: "b", party: "R", votes: 0 },
  ],
  totalVotes: 0,
  remaining: 0,
  pctExpected: 0,
  band: 3,
  now: "2026-11-04T02:00:00Z",
  ...over,
});

describe("callStatus", () => {
  it("not_started with no votes", () => {
    expect(callStatus(base({})).status).toBe("not_started");
  });

  it("mathematically decided: margin in votes exceeds remaining, regardless of history", () => {
    const r = callStatus(
      base({
        candidates: [
          { id: "a", party: "D", votes: 600 },
          { id: "b", party: "R", votes: 300 },
        ],
        totalVotes: 900,
        remaining: 200,
        pctExpected: 900 / 1100,
        history: [],
      }),
    );
    expect(r.status).toBe("projected");
    expect(r.reason).toBe("decided");
    expect(r.projection).toMatchObject({ winnerId: "a", party: "D", by: "bigboard", at: "2026-11-04T02:00:00Z", band: 3 });
    expect(r.projection?.marginPts).toBeCloseTo(300 / 9, 10);
  });

  it("not decided when margin equals remaining", () => {
    const r = callStatus(
      base({
        candidates: [
          { id: "a", party: "D", votes: 600 },
          { id: "b", party: "R", votes: 300 },
        ],
        totalVotes: 900,
        remaining: 300,
        pctExpected: 0.3,
      }),
    );
    expect(r.status).toBe("counting");
  });

  const modelInput = (history: Array<string | undefined>, over: Partial<CallInput> = {}) =>
    base({
      candidates: [
        { id: "a", party: "D", votes: 55000 },
        { id: "b", party: "R", votes: 45000 },
      ],
      totalVotes: 100000,
      remaining: 50000,
      pctExpected: 100000 / 150000,
      band: 3,
      history,
      ...over,
    });

  it("model call requires margin > max(2, band), pct >= 0.5 and a stable leader across 2 ticks", () => {
    expect(callStatus(modelInput(["a"])).status).toBe("projected");
    expect(callStatus(modelInput(["a"])).reason).toBe("model");
    expect(callStatus(modelInput([])).status).toBe("counting"); // first tick in the lead
    expect(callStatus(modelInput(["b"])).status).toBe("counting"); // lead just flipped
    expect(callStatus(modelInput(["b", "a"])).status).toBe("projected");
    expect(callStatus(modelInput(["a", "b"])).status).toBe("counting");
  });

  it("model call blocked by a wide band or low pct in", () => {
    expect(callStatus(modelInput(["a"], { band: 12 })).status).toBe("counting");
    expect(callStatus(modelInput(["a"], { pctExpected: 0.4 })).status).toBe("counting");
  });

  it("uses a 2-point floor when the band is tiny", () => {
    const r = callStatus(
      modelInput(["a"], {
        candidates: [
          { id: "a", party: "D", votes: 50900 },
          { id: "b", party: "R", votes: 49100 },
        ],
        band: 0.5,
      }),
    );
    expect(r.marginPts).toBeCloseTo(1.8, 10);
    expect(r.status).toBe("counting");
  });

  it("stableTicks can be raised", () => {
    expect(callStatus(modelInput(["a"], { stableTicks: 3 })).status).toBe("counting");
    expect(callStatus(modelInput(["a", "a"], { stableTicks: 3 })).status).toBe("projected");
  });

  it("keeps a prior projection while its winner still leads, drops it when the lead flips", () => {
    const prior = { winnerId: "a", party: "D" as const, by: "bigboard" as const, at: "t0", marginPts: 10, band: 2 };
    const sticky = callStatus(
      modelInput([], {
        candidates: [
          { id: "a", party: "D", votes: 50100 },
          { id: "b", party: "R", votes: 49900 },
        ],
        priorProjection: prior,
      }),
    );
    expect(sticky.status).toBe("projected");
    expect(sticky.reason).toBe("sticky");
    expect(sticky.projection).toBe(prior);

    const flipped = callStatus(
      modelInput(["a"], {
        candidates: [
          { id: "a", party: "D", votes: 49900 },
          { id: "b", party: "R", votes: 50100 },
        ],
        priorProjection: prior,
      }),
    );
    expect(flipped.status).toBe("counting");
    expect(flipped.projection).toBeUndefined();
  });

  describe("majority runoff (GA)", () => {
    const ga = (a: number, b: number, c: number, remaining: number, over: Partial<CallInput> = {}) =>
      base({
        candidates: [
          { id: "a", party: "D", votes: a },
          { id: "b", party: "R", votes: b },
          { id: "c", party: "L", votes: c },
        ],
        totalVotes: a + b + c,
        remaining,
        pctExpected: (a + b + c) / (a + b + c + remaining),
        runoffRule: "majority",
        history: ["a", "a"],
        band: 1,
        ...over,
      });

    it("runoff when the leader cannot reach 50% even with every remaining vote", () => {
      // 470k of a 1,000k final; max 490k < 500k
      const r = callStatus(ga(470000, 450000, 60000, 20000));
      expect(r.status).toBe("runoff");
      expect(r.reason).toBe("runoff-locked");
      expect(r.projection).toBeUndefined();
    });

    it("projected when the leader already has a majority of the final total", () => {
      const r = callStatus(ga(520000, 400000, 30000, 50000));
      expect(r.status).toBe("projected");
      expect(r.reason).toBe("majority-locked");
      expect(r.projection?.winnerId).toBe("a");
    });

    it("plurality decided but majority uncertain stays counting", () => {
      // margin 200k > remaining 150k, but 450k/1150k = 39% and max 600k/1150k = 52%
      const r = callStatus(ga(450000, 250000, 300000, 150000));
      expect(r.status).toBe("counting");
    });

    it("model call in a majority state needs a cushioned majority", () => {
      // 52.5% with margin 6.3 pts > 2, pct 0.95, stable -> projected (52.5 > 51)
      expect(callStatus(ga(525000, 462000, 13000, 50000)).status).toBe("projected");
      // 50.5% is not enough cushion (needs > 51) even though margin > 2
      expect(callStatus(ga(505000, 445000, 50000, 50000)).status).toBe("counting");
    });
  });
});
