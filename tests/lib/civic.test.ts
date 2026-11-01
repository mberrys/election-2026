import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CivicError, lookupBallot, normalizeVoterInfo, pickElection, type CivicElection } from "../../src/lib/civic";
import { allow } from "../../src/lib/rate-limit";

// The rate-limit test must use the in-memory path whatever Redis variables the shell or CI has set.
vi.mock("../../src/lib/redis", () => ({ getRedis: () => null }));

const E = (id: string, name: string, electionDay: string): CivicElection => ({ id, name, electionDay });

describe("pickElection", () => {
  const list = [E("2000", "VIP Test Election", "2033-06-06"), E("9001", "Primary", "2026-06-02"), E("9002", "General Election", "2026-11-03"), E("9003", "Runoff", "2026-12-01")];

  it("prefers the election on the requested day and skips the test election", () => {
    expect(pickElection(list, "2026-11-03", "2026-10-31")?.id).toBe("9002");
  });

  it("falls back to the soonest upcoming election", () => {
    expect(pickElection(list, "2027-01-01", "2026-11-04")?.id).toBe("9003");
  });

  it("returns undefined when nothing real is upcoming", () => {
    expect(pickElection([E("2000", "VIP Test Election", "2033-06-06")], "2026-11-03", "2026-10-31")).toBeUndefined();
  });
});

const raw = {
  normalizedInput: { line1: "1 Main St", city: "Austin", state: "TX", zip: "78701" },
  pollingLocations: [
    { address: { locationName: "City Hall", line1: "301 W 2nd St", city: "Austin", state: "TX", zip: "78701" }, pollingHours: "7am-7pm", notes: "Use the east door" },
    { address: {} },
  ],
  earlyVoteSites: [{ address: { line1: "1 Early Way", city: "Austin", state: "TX" }, startDate: "2026-10-19", endDate: "2026-10-30" }],
  contests: [
    {
      office: "U.S. Senate",
      level: ["country"],
      special: true,
      numberElected: 1,
      district: { name: "Texas" },
      candidates: [{ name: "A Candidate", party: "Democratic", candidateUrl: "https://example.test/a" }, { name: "" }],
    },
    { referendumTitle: "Prop 1", referendumBrief: "Bonds for parks", level: ["administrativeArea2"] },
    { type: "General" },
  ],
  state: [{ electionAdministrationBody: { name: "Texas SOS", electionInfoUrl: "https://example.test/info", electionOfficials: [{ officePhoneNumber: "555-0100" }] } }],
  mailOnly: false,
};

describe("normalizeVoterInfo", () => {
  const out = normalizeVoterInfo(raw, E("9002", "General", "2026-11-03"));

  it("keeps places with an address and drops empty ones", () => {
    expect(out.pollingPlaces).toEqual([
      { name: undefined, address: "City Hall, 301 W 2nd St, Austin, TX 78701", hours: "7am-7pm", notes: "Use the east door", startDate: undefined, endDate: undefined },
    ]);
    expect(out.earlyVoteSites[0]).toMatchObject({ address: "1 Early Way, Austin, TX", startDate: "2026-10-19", endDate: "2026-10-30" });
    expect(out.dropOffLocations).toEqual([]);
  });

  it("splits candidate contests from referenda and skips unlabeled ones", () => {
    expect(out.contests).toHaveLength(2);
    expect(out.contests[0]).toMatchObject({ kind: "candidate", title: "U.S. Senate", level: "country", special: true, seats: 1, district: "Texas" });
    expect(out.contests[0].candidates).toEqual([{ name: "A Candidate", party: "Democratic", url: "https://example.test/a" }]);
    expect(out.contests[1]).toMatchObject({ kind: "referendum", title: "Prop 1", brief: "Bonds for parks" });
  });

  it("carries the normalized address, election office and mail-only flag", () => {
    expect(out.address).toBe("1 Main St, Austin, TX 78701");
    expect(out.officials).toMatchObject({ name: "Texas SOS", url: "https://example.test/info", phone: "555-0100" });
    expect(out.mailOnly).toBe(false);
  });
});

describe("lookupBallot", () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  beforeEach(() => vi.stubEnv("GOOGLE_CIVIC_API_KEY", "test-key-123"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("refuses without a key", async () => {
    vi.stubEnv("GOOGLE_CIVIC_API_KEY", "");
    await expect(lookupBallot("1 Main St, Austin, TX")).rejects.toMatchObject({ kind: "not-configured" });
  });

  it("looks up the elections, then the address for the chosen election", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: URL) => {
        calls.push(String(u));
        return String(u).includes("/elections") ? ok({ elections: [{ id: "9002", name: "General", electionDay: "2026-11-03" }] }) : ok(raw);
      }),
    );
    const { lookupBallot: fresh } = await import("../../src/lib/civic");
    const r = await fresh("1 Main St, Austin, TX", { day: "2026-11-03", today: "2026-10-31" });
    expect(r.election.id).toBe("9002");
    expect(r.pollingPlaces).toHaveLength(1);
    const voter = new URL(calls.find((c) => c.includes("/voterinfo"))!);
    expect(voter.searchParams.get("electionId")).toBe("9002");
    expect(voter.searchParams.get("address")).toBe("1 Main St, Austin, TX");
  });

  it("maps Google's 400 and 404 to user-safe errors and never leaks the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: URL) => (String(u).includes("/elections") ? ok({ elections: [{ id: "9002", name: "General", electionDay: "2026-11-03" }] }) : ok({}, 400))),
    );
    const { lookupBallot: fresh } = await import("../../src/lib/civic");
    await expect(fresh("nowhere", { day: "2026-11-03", today: "2026-10-31" })).rejects.toMatchObject({ kind: "bad-address" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom https://www.googleapis.com/civicinfo/v2/elections?key=test-key-123");
      }),
    );
    vi.resetModules();
    const again = await import("../../src/lib/civic");
    const err = await again.lookupBallot("x street", { day: "2026-11-03", today: "2026-10-31" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(again.CivicError);
    expect((err as CivicError).message).not.toContain("test-key-123");
  });
});

describe("rate limit", () => {
  it("allows up to the limit within a window, then blocks, then resets", async () => {
    const k = `t-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(await allow(k, 3, 60, t0)).toBe(true);
    expect(await allow(k, 3, 60, t0)).toBe(false);
    expect(await allow(k, 3, 60, t0 + 61_000)).toBe(true);
  });
});
