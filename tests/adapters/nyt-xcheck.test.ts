import { afterEach, describe, expect, it } from "vitest";
import { nytXcheck, parseNytSenate, type NytSenateFile } from "../../src/data/adapters/nyt-xcheck";
import { fixtureFetch, makeCtx } from "./helpers";

/**
 * Synthetic document mirroring the observed results-senate.json shape.
 * No live NYT data is stored in the repo (ToS: no cached datasets).
 */
const synthetic: NytSenateFile = {
  races: [
    {
      nyt_id: "ZZ-G-S-2026-11-03",
      office_id: "S",
      race_type_id: "G",
      candidate_metadata: {
        "doe-j": { first_name: "Jane", last_name: "Doe", incumbent: true, party: { nyt_id: "DEM" } },
        "roe-r": { first_name: "Rick", last_name: "Roe", incumbent: false, party: { nyt_id: "REP" } },
      },
      top_reporting_unit: {
        nyt_id: "ZZ-state",
        name: "Zed",
        level: "state",
        fips_state: "99",
        fips_county: null,
        state_postal: "ZZ",
        eevp: 42,
        total_votes: 150,
        total_expected_vote: 357,
        precincts_reporting: 10,
        precincts_total: 25,
        candidates: [
          { nyt_id: "doe-j", votes: { total: 90 } },
          { nyt_id: "roe-r", votes: { total: 60 } },
        ],
      },
      reporting_units: [
        {
          nyt_id: "ZZ-001",
          name: "Alpha",
          level: "county",
          fips_state: "99",
          fips_county: "001",
          state_postal: "ZZ",
          eevp: 50,
          total_votes: 150,
          total_expected_vote: 300,
          precincts_reporting: 10,
          precincts_total: 20,
          candidates: [
            { nyt_id: "doe-j", votes: { total: 90 } },
            { nyt_id: "roe-r", votes: { total: 60 } },
          ],
        },
      ],
    },
    {
      nyt_id: "YY-S_W-S-2026-11-03",
      office_id: "S",
      race_type_id: "S_W",
      candidate_metadata: {},
      top_reporting_unit: {
        nyt_id: "YY-state", name: "Why", level: "state", fips_state: "98", fips_county: null, state_postal: "YY",
        eevp: 0, total_votes: 0, total_expected_vote: 100, precincts_reporting: 0, precincts_total: 5, candidates: [],
      },
      reporting_units: [],
    },
  ],
};

describe("nyt-xcheck", () => {
  const prev = process.env.ENABLE_NYT_XCHECK;
  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_NYT_XCHECK;
    else process.env.ENABLE_NYT_XCHECK = prev;
  });

  it("is a no-op unless ENABLE_NYT_XCHECK=1 (never fetches)", async () => {
    delete process.env.ENABLE_NYT_XCHECK;
    const f = fixtureFetch([[/nyt/, JSON.stringify(synthetic)]]);
    const ctx = makeCtx(f);
    expect(await nytXcheck.fetch(ctx)).toEqual([]);
    expect(f.calls).toEqual([]);
    expect(nytXcheck.tier).toBe("C");
  });

  it("when enabled, tags races tier C / adapter nyt-xcheck, copies eevp but never race calls", async () => {
    process.env.ENABLE_NYT_XCHECK = "1";
    const f = fixtureFetch([["/2026-11-03/results-senate.json", JSON.stringify(synthetic)]]);
    const ctx = makeCtx(f);
    const races = await nytXcheck.fetch(ctx);
    expect(f.calls.length).toBe(1);
    expect(races.map((r) => r.id).sort()).toEqual(["senate:YY-special", "senate:ZZ"]);
    const zz = races.find((r) => r.id === "senate:ZZ")!;
    expect(zz.source).toMatchObject({ adapter: "nyt-xcheck", tier: "C" });
    expect(zz.pctExpected).toBe(42);
    expect(zz.expectedVote).toBe(357);
    expect(zz.projection).toBeUndefined();
    expect(zz.status).toBe("counting");
    expect(zz.candidates.map((c) => c.id)).toEqual(["doe-jane", "roe-rick"]);
    expect(zz.units[0]).toMatchObject({ fips: "99001", totalVotes: 150, pctExpected: 50 });
    expect(parseNytSenate(synthetic, ctx, "x").length).toBe(2);
  });
});
