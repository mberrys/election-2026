import { describe, expect, it } from "vitest";
import { applyAnalytics, expectedStateMargin, type UnitBaseline } from "../../src/analytics";
import { Race as RaceSchema, type Race, type RaceMeta, type ReportingUnit, type StateMeta } from "../../src/data/schema";

const src = { adapter: "test", tier: "A" as const, fetchedAt: "2026-11-04T01:00:00Z" };

function unit(id: string, fips: string, dem: number, gop: number, over: Partial<ReportingUnit> = {}): ReportingUnit {
  return { id, name: id, fips, level: "county", votes: { dem, gop }, totalVotes: dem + gop, ...over };
}

function race(over: Partial<Race> & { dem: number; gop: number; other?: number }): Race {
  const { dem, gop, other = 0, ...rest } = over;
  const total = dem + gop + other;
  const candidates: Race["candidates"] = [
    { id: "dem", name: "Dem", party: "D", votes: dem, pct: total ? (dem / total) * 100 : 0 },
    { id: "gop", name: "Gop", party: "R", votes: gop, pct: total ? (gop / total) * 100 : 0 },
  ];
  if (other) candidates.push({ id: "lib", name: "Lib", party: "L", votes: other, pct: (other / total) * 100 });
  return {
    id: "senate:PA",
    office: "senate",
    state: "PA",
    special: false,
    name: "PA Senate",
    candidates,
    totalVotes: total,
    status: "counting",
    units: [],
    source: src,
    updatedAt: "2026-11-04T01:00:00Z",
    ...rest,
  };
}

function meta(over: Partial<RaceMeta> = {}): RaceMeta {
  return {
    id: "senate:PA",
    office: "senate",
    state: "PA",
    special: false,
    name: "PA Senate",
    candidates: [],
    ratings: { consensus: "tossup" },
    baseline: { presMargin2024: -2 },
    runoffRule: "none",
    ...over,
  };
}

const paState: StateMeta = { abbr: "PA", name: "Pennsylvania", fips: "42", pollCloseEt: "20:00", voteOrder: "early-first", feeds: [] };

const baselines = new Map<string, UnitBaseline>([
  ["42101", { margin2024: 60, turnout2022: 700000 }],
  ["42999", { margin2024: -35, turnout2022: 1300000 }],
]);

describe("expectedStateMargin", () => {
  it("prefers polls, then rating, then prior race, then 2024", () => {
    expect(expectedStateMargin(meta({ polls: { d: 48, r: 45, n: 10, asOf: "t", source: "s" } }))).toBe(3);
    expect(expectedStateMargin(meta({ ratings: { consensus: "lean-r" } }))).toBe(-5);
    expect(expectedStateMargin(meta({ ratings: {}, baseline: { prevRaceMargin: 4, presMargin2024: -2 } }))).toBe(4);
    expect(expectedStateMargin(meta({ ratings: {}, baseline: { presMargin2024: -2 } }))).toBe(-2);
    expect(expectedStateMargin(undefined)).toBe(0);
  });
});

describe("applyAnalytics: red mirage", () => {
  // Tick 1: Philadelphia (D+60 in 2024) has 60% in from mail; rural (R+35) has 10% in.
  const tick1 = race({
    dem: 375000,
    gop: 175000,
    units: [unit("Philadelphia", "42101", 336000, 84000), unit("Rural", "42999", 39000, 91000)],
  });

  it("tick 1: D leads by 36 on the board but the model projects R and keeps counting", () => {
    const out = applyAnalytics(tick1, meta(), paState, baselines, []);
    expect(out.marginDR).toBeCloseTo(36.3636, 3);
    expect(out.leaderId).toBe("dem");
    expect(out.expectedVote).toBe(2000000);
    expect(out.pctExpected).toBeCloseTo(0.275, 10);
    expect(out.model?.remainingVotes).toBe(1450000);
    expect(out.model?.projectedMarginDR).toBeCloseTo(-1.75, 6);
    // band 12*(0.725)^1.5 = 7.41, x1.5 mirage inflation while < 50% in
    expect(out.model?.band).toBeCloseTo(12 * Math.pow(0.725, 1.5) * 1.5, 6);
    expect(out.status).toBe("counting");
    expect(out.projection).toBeUndefined();

    const philly = out.units[0];
    expect(philly.pctExpected).toBeCloseTo(0.6, 10);
    expect(philly.margin).toBeCloseTo(60, 10);
    expect(philly.benchmarkMargin).toBe(62); // 60 + swing(+2)
    expect(philly.overUnder).toBeCloseTo(-2, 10);
    expect(philly.baselineMargin2024).toBe(60);

    const rural = out.units[1];
    expect(rural.pctExpected).toBeCloseTo(0.1, 10);
    expect(rural.margin).toBeCloseTo(-40, 10);
    expect(rural.benchmarkMargin).toBe(-33);
    // D needs ~33.9% of the rural remainder to land the county on its state-tie benchmark (-33)
    expect(rural.needsOfRemaining).toBeCloseTo(33.889, 2);
  });

  it("validates against the zod Race schema and does not mutate its input", () => {
    const frozen = JSON.stringify(tick1);
    const out = applyAnalytics(tick1, meta(), paState, baselines, []);
    expect(RaceSchema.safeParse(out).success).toBe(true);
    expect(JSON.stringify(tick1)).toBe(frozen);
    expect(out).not.toBe(tick1);
    expect(out.units[0]).not.toBe(tick1.units[0]);
  });

  // Tick 2: Philly complete, rural 92% in; R now leads by 60k with ~100k left.
  const tick2 = race({
    dem: 920000,
    gop: 980000,
    units: [
      unit("Philadelphia", "42101", 560000, 140000, { complete: true }),
      unit("Rural", "42999", 360000, 840000),
    ],
  });

  it("tick 2: lead flips to R; margin clears the band but the leader is not yet stable", () => {
    const out = applyAnalytics(tick2, meta(), paState, baselines, ["dem"]);
    expect(out.leaderId).toBe("gop");
    expect(out.marginDR).toBeCloseTo(-3.158, 2);
    expect(out.pctExpected).toBeCloseTo(0.95, 10);
    expect(out.model?.remainingVotes).toBeCloseTo(100000, 6);
    expect(out.model?.band).toBe(0.5);
    expect(out.model?.projectedMarginDR).toBeCloseTo(-4.908, 2);
    expect(out.status).toBe("counting");
    expect(out.units[0].pctExpected).toBe(1);
    expect(out.units[0].expectedVote).toBe(700000);
  });

  it("accepts the ingest-style { prevLeaderId } history object", () => {
    expect(applyAnalytics(tick2, meta(), paState, baselines, { prevLeaderId: "dem" }).status).toBe("counting");
    expect(applyAnalytics(tick2, meta(), paState, baselines, { prevLeaderId: "gop" }).status).toBe("projected");
    expect(applyAnalytics(tick2, meta(), paState, baselines, { prevLeaderId: undefined }).status).toBe("counting");
  });

  it("tick 3: same numbers with a stable R lead -> Big Board projection for R", () => {
    const out = applyAnalytics(tick2, meta(), paState, baselines, ["dem", "gop"], { now: "2026-11-04T03:00:00Z" });
    expect(out.status).toBe("projected");
    expect(out.projection).toMatchObject({ winnerId: "gop", party: "R", by: "bigboard", at: "2026-11-04T03:00:00Z", band: 0.5 });
    expect(out.projection?.marginPts).toBeCloseTo(3.158, 2);
    expect(out.model?.needsOfRemainingD).toBeCloseTo(80, 6); // D needs 80% of the last 100k to tie
    expect(out.model?.needsOfRemainingR).toBeCloseTo(20, 6);
  });

  it("keeps the projection on the next tick even if the margin narrows", () => {
    const called = applyAnalytics(tick2, meta(), paState, baselines, ["dem", "gop"]);
    const narrower = race({
      dem: 990000,
      gop: 1000000,
      projection: called.projection,
      status: called.status,
      units: [unit("Philadelphia", "42101", 560000, 140000, { complete: true }), unit("Rural", "42999", 430000, 860000)],
    });
    const out = applyAnalytics(narrower, meta(), paState, baselines, ["dem", "gop", "gop"]);
    expect(out.status).toBe("projected");
    expect(out.projection).toBe(called.projection);
  });
});

describe("applyAnalytics: race-level fallbacks", () => {
  it("mathematically decided call without units, using race baseline turnout", () => {
    const r = race({ dem: 600, gop: 300 });
    const out = applyAnalytics(r, meta({ baseline: { turnout2022: 1000, presMargin2024: 5 } }), undefined, new Map(), []);
    expect(out.expectedVote).toBe(1000);
    expect(out.model?.remainingVotes).toBe(100);
    expect(out.status).toBe("projected");
    expect(out.projection?.winnerId).toBe("dem");
    expect(out.marginPts).toBeCloseTo(300 / 9, 10);
    expect(out.leaderId).toBe("dem");
    // no units: projection blends current margin toward the expected margin (tossup rating -> 0)
    expect(out.model?.projectedMarginDR).toBeCloseTo(0.9 * (300 / 9), 6);
  });

  it("GA majority rule: leader cannot reach 50% -> runoff", () => {
    const r = race({ id: "senate:GA", state: "GA", dem: 450000, gop: 250000, other: 300000 });
    const out = applyAnalytics(
      r,
      meta({ id: "senate:GA", state: "GA", runoffRule: "majority", baseline: { turnout2022: 1100000 } }),
      undefined,
      new Map(),
      ["dem", "dem"],
    );
    expect(out.model?.remainingVotes).toBe(100000);
    expect(out.status).toBe("runoff");
    expect(out.projection).toBeUndefined();
    expect(out.leaderId).toBe("dem");
  });

  it("impossible needs are clamped to a finite schema-safe value", () => {
    const r = race({ dem: 100, gop: 900, status: "counting" });
    const out = applyAnalytics(r, meta({ baseline: { turnout2022: 1000 } }), undefined, new Map(), []);
    // remaining re-baselined to 1000/0.97 - 1000 ~ 30.9; D needs >100%
    expect(out.model?.needsOfRemainingD).toBeGreaterThan(100);
    expect(Number.isFinite(out.model?.needsOfRemainingD)).toBe(true);
    expect(out.model?.needsOfRemainingR).toBeLessThan(0);
    expect(RaceSchema.safeParse(out).success).toBe(true);
  });

  it("not_started when there are no votes; certified status is preserved", () => {
    const empty = applyAnalytics(race({ dem: 0, gop: 0 }), meta(), undefined, new Map(), []);
    expect(empty.status).toBe("not_started");
    expect(empty.leaderId).toBeUndefined();
    expect(empty.marginDR).toBeUndefined();

    const cert = applyAnalytics(race({ dem: 40, gop: 60, status: "certified" }), meta(), undefined, new Map(), []);
    expect(cert.status).toBe("certified");
    expect(cert.pctExpected).toBe(1);
    expect(cert.leaderId).toBe("gop");
  });
});
