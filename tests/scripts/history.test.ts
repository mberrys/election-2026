import { describe, expect, it } from "vitest";
import { parsePresidentCsv } from "../../scripts/lib/step-history";
import { pollTrend, type VoteHubPoll } from "../../scripts/lib/step-polls";

const HEADER = "year,state,state_po,state_fips,state_cen,state_ic,office,candidate,party_detailed,writein,candidatevotes,totalvotes,version,notes,party_simplified";
const row = (year: number, st: string, party: string, votes: number, total: number, office = "US PRESIDENT") =>
  `${year},X,${st},1,1,1,${office},"CAND, A",${party},False,${votes},${total},1,,${party}`;

describe("parsePresidentCsv", () => {
  it("computes D-R margins by state and a national popular vote", () => {
    const csv = [
      HEADER,
      row(2020, "AA", "DEMOCRAT", 600, 1000),
      row(2020, "AA", "REPUBLICAN", 350, 1000),
      row(2020, "AA", "OTHER", 50, 1000),
      row(2020, "BB", "DEMOCRAT", 300, 500),
      row(2020, "BB", "REPUBLICAN", 200, 500),
      row(2024, "AA", "DEMOCRAT", 400, 1000),
      row(2024, "AA", "REPUBLICAN", 590, 1000),
    ].join("\n");
    const p = parsePresidentCsv(csv);
    expect(p.years).toEqual([2020, 2024]);
    expect(p.states.AA).toEqual({ "2020": 25, "2024": -19 });
    expect(p.states.BB["2020"]).toBe(20);
    // national 2020: D 900, R 550, total 1500
    expect(p.national["2020"]).toEqual({ d: 60, r: 36.67, margin: 23.33 });
  });

  it("sums multiple lines for one party and ignores other offices", () => {
    const csv = [
      HEADER,
      row(2016, "AA", "DEMOCRAT", 200, 1000),
      row(2016, "AA", "DEMOCRAT", 100, 1000),
      row(2016, "AA", "REPUBLICAN", 500, 1000),
      row(2016, "AA", "DEMOCRAT", 999, 1000, "US SENATE"),
    ].join("\n");
    expect(parsePresidentCsv(csv).states.AA["2016"]).toBe(-20);
  });
});

const poll = (end: string, d: number, r: number, internal = false): VoteHubPoll =>
  ({ end_date: end, internal, pollster: "p", answers: [{ choice: "Democratic", pct: d }, { choice: "Republican", pct: r }] }) as unknown as VoteHubPoll;
const pick = (p: VoteHubPoll) => ({ d: p.answers[0].pct, r: p.answers[1].pct });

describe("pollTrend", () => {
  it("builds weekly rolling averages, oldest first, skipping internals and thin windows", () => {
    const polls = [
      poll("2026-01-02", 40, 40),
      poll("2026-01-05", 42, 40),
      poll("2026-01-08", 44, 40),
      poll("2026-01-09", 99, 1, true),
      poll("2026-01-12", 46, 40),
    ];
    const t = pollTrend(polls, pick, { minN: 3, windowDays: 28, start: "2026-01-01" });
    expect(t.length).toBeGreaterThan(0);
    expect(t.map((x) => x.t)).toEqual([...t.map((x) => x.t)].sort());
    const last = t[t.length - 1];
    expect(last.t).toBe("2026-01-12");
    expect(last.n).toBe(4);
    expect(last.d).toBe(43);
    expect(t.every((x) => x.n >= 3)).toBe(true);
  });

  it("returns nothing when there are too few polls", () => {
    expect(pollTrend([poll("2026-02-01", 40, 40)], pick, { minN: 3 })).toEqual([]);
  });
});
