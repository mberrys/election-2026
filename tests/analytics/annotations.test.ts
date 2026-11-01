import { describe, expect, it } from "vitest";
import { annotationsFor, challengedBallotsFor } from "../../src/data/annotations";
import { stalledMinutes } from "../../src/data/stall";

const flag = (challengedBallots: number, standing?: "pending" | "rejected") =>
  ({ kind: "set-aside", summary: "demand", asOf: "2026-11-03", challengedBallots, standing }) as const;

describe("challengedBallotsFor", () => {
  it("counts pending and unmarked challenges", () => {
    expect(challengedBallotsFor([flag(400), flag(100, "pending")])).toBe(500);
  });
  it("ignores a rejected challenge, but still shows it", () => {
    expect(challengedBallotsFor([flag(400, "rejected"), flag(100)])).toBe(100);
    const list = [{ state: "WA", ...flag(400, "rejected") }];
    expect(annotationsFor({ id: "senate:WA", state: "WA", office: "senate" }, list)[0].standing).toBe("rejected");
  });
});

describe("stalledMinutes", () => {
  const race = { lastChangeAt: "2026-11-04T00:00:00Z", pctExpected: 0.5, totalVotes: 1000 };
  it("flags a mid-count freeze after 45 minutes", () => {
    expect(stalledMinutes(race, Date.parse("2026-11-04T01:00:00Z"))).toBe(60);
    expect(stalledMinutes(race, Date.parse("2026-11-04T00:30:00Z"))).toBeNull();
  });
  it("treats the last stretch as quiet, not stalled", () => {
    expect(stalledMinutes({ ...race, pctExpected: 0.95 }, Date.parse("2026-11-04T03:00:00Z"))).toBeNull();
  });
});
