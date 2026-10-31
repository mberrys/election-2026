import { afterEach, describe, expect, it } from "vitest";
import { discoverSlug, makeEnhancedVotingAdapter } from "../../src/data/adapters/enhanced-voting";
import { runAdapters } from "../../src/data/adapters/types";
import { Race } from "../../src/data/schema";
import { fixture, fixtureFetch, makeCtx, meta, sumVotes } from "./helpers";

const VA_HOST = "https://enr.elections.virginia.gov";
const GA_HOST = "https://results.sos.ga.gov";

describe("enhanced-voting VA 2026 (staged)", () => {
  const fetchStub = fixtureFetch([
    [`${VA_HOST}/results/public/api/jurisdictions/virginia`, fixture("va/jurisdictions.json")],
    [`${VA_HOST}/results/public/api/elections/virginia/2026-November-General`, fixture("va/election.2026.json")],
    [`${VA_HOST}/cdn/results/virginia/export-2026-November-General.json`, fixture("va/export-2026-November-General.truncated.json")],
  ]);
  const metas = [
    meta({
      id: "senate:VA",
      office: "senate",
      state: "VA",
      name: "VA Senate",
      candidates: [
        { id: "warner-mark", name: "Mark Warner", party: "D", incumbent: true, aliases: ["Mark R. Warner"] },
        { id: "mizusawa-bert", name: "Bert Mizusawa", party: "R", aliases: [] },
      ],
    }),
  ];

  it("discovers the slug from the jurisdiction list", async () => {
    const ctx = makeCtx(fetchStub);
    expect(await discoverSlug(ctx, VA_HOST, "virginia", "2026-11-03")).toBe("2026-November-General");
    expect(await discoverSlug(ctx, VA_HOST, "virginia", "2026-08-04")).toMatch(/2026-August/);
  });

  it("parses senate, 11 house seats, amendments; county units keyed by 51xxx fips", async () => {
    const ctx = makeCtx(fetchStub, metas);
    const adapter = makeEnhancedVotingAdapter({
      id: "ev-va",
      state: "VA",
      tier: "A",
      host: VA_HOST,
      jurisdiction: "virginia",
      electionDate: "2026-11-03",
      attribution: "Virginia Department of Elections",
    });
    const races = await adapter.fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    const ids = races.map((r) => r.id);
    expect(ids).toContain("senate:VA");
    for (let d = 1; d <= 11; d++) expect(ids).toContain(`house:VA-${String(d).padStart(2, "0")}`);
    expect(ids).toContain("ballot:VA-amendment-1");
    expect(ids.some((i) => /delegates|sheriff|mayor/i.test(i))).toBe(false);

    const sen = races.find((r) => r.id === "senate:VA")!;
    expect(sen.status).toBe("not_started");
    expect(sen.candidates.map((c) => c.id).sort()).toEqual(["mizusawa-bert", "warner-mark", "write-in"]);
    expect(sen.candidates.find((c) => c.id === "warner-mark")?.incumbent).toBe(true);
    expect(sen.units.map((u) => u.fips).sort()).toEqual(["51059", "51071", "51087", "51510", "51760", "51810"]);
    expect(sen.units.find((u) => u.fips === "51760")?.name).toBe("Richmond City");
    // precincts roll up from localities (state-level fields are null in the export)
    expect(sen.precinctsTotal).toBe(sen.units.reduce((s, u) => s + (u.precinctsTotal ?? 0), 0));
    expect(sen.precinctsTotal).toBeGreaterThan(0);
    // House units only include localities that carry that district
    const h8 = races.find((r) => r.id === "house:VA-08")!;
    expect(h8.units.every((u) => ["51059", "51510"].includes(u.fips!))).toBe(true);
  });
});

describe("enhanced-voting VA 2025 (certified, real votes)", () => {
  const fetchStub = fixtureFetch([
    [`${VA_HOST}/results/public/api/elections/virginia/2025-November-General`, JSON.stringify({ isOfficialResults: true, lastUpdated: "x", asOf: "x" })],
    [`${VA_HOST}/cdn/results/virginia/export-2025-November-General.json`, fixture("va/export-2025-November-General.truncated.json")],
  ]);
  it("governor totals, modes and certified status", async () => {
    const ctx = makeCtx(fetchStub);
    const races = await makeEnhancedVotingAdapter({
      id: "ev-va",
      state: "VA",
      tier: "A",
      host: VA_HOST,
      jurisdiction: "virginia",
      electionSlug: "2025-November-General",
      electionDate: "2025-11-04",
      attribution: "VA",
    }).fetch(ctx);
    expect(races.map((r) => r.id)).toEqual(["governor:VA"]);
    const gov = races[0]!;
    expect(gov.status).toBe("certified");
    expect(gov.leaderId).toBe("spanberger-abigail");
    expect(gov.candidates[0]?.votes).toBe(1_976_857);
    expect(gov.totalVotes).toBe(gov.candidates.reduce((s, c) => s + c.votes, 0));
    expect(gov.marginDR).toBeGreaterThan(10);
    const m = gov.modes!;
    expect(m.early).toBeGreaterThan(0);
    expect(m.mail).toBeGreaterThan(0);
    expect(m.electionDay).toBeGreaterThan(0);
    expect(m.provisional).toBeGreaterThan(0);
    const fairfax = gov.units.find((u) => u.fips === "51059")!;
    expect(fairfax.totalVotes).toBe(sumVotes(fairfax.votes));
    expect(fairfax.complete).toBe(true);
    expect(fairfax.modes?.early).toBeGreaterThan(0);
  });
});

describe("enhanced-voting GA", () => {
  const fetchStub = fixtureFetch([
    [`${GA_HOST}/results/public/api/jurisdictions/Georgia`, fixture("ga/jurisdictions.json")],
    [`${GA_HOST}/results/public/api/elections/Georgia/2024NovGen`, fixture("ga/election.2024NovGen.json")],
    [`${GA_HOST}/cdn/results/Georgia/export-2024NovGen.json`, fixture("ga/export-2024NovGen.truncated.json")],
  ]);
  const prevEnv = process.env.GA_ELECTION_SLUG;
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.GA_ELECTION_SLUG;
    else process.env.GA_ELECTION_SLUG = prevEnv;
  });

  it("2026 slug is not yet published: discovery returns undefined and the adapter fails in isolation", async () => {
    delete process.env.GA_ELECTION_SLUG;
    const ctx = makeCtx(fetchStub);
    expect(await discoverSlug(ctx, GA_HOST, "Georgia", "2026-11-03")).toBeUndefined();
    expect(await discoverSlug(ctx, GA_HOST, "Georgia", "2024-11-05")).toBe("2024NovGen");
    const adapter = makeEnhancedVotingAdapter({
      id: "ev-ga",
      state: "GA",
      tier: "A",
      host: GA_HOST,
      jurisdiction: "Georgia",
      slugEnv: "GA_ELECTION_SLUG",
      electionDate: "2026-11-03",
      attribution: "GA",
    });
    const { races, feeds } = await runAdapters([adapter], { fetch: fetchStub, now: ctx.now, metas: ctx.metas }, { timeoutMs: 5000 });
    expect(races).toEqual([]);
    expect(feeds[0]?.ok).toBe(false);
    expect(feeds[0]?.lastError).toMatch(/no election slug/);
  });

  it("2024NovGen via env override: 14 house races, county fips by name, GA vote-method groups → modes", async () => {
    process.env.GA_ELECTION_SLUG = "2024NovGen";
    const ctx = makeCtx(fetchStub);
    const races = await makeEnhancedVotingAdapter({
      id: "ev-ga",
      state: "GA",
      tier: "A",
      host: GA_HOST,
      jurisdiction: "Georgia",
      slugEnv: "GA_ELECTION_SLUG",
      electionDate: "2026-11-03",
      attribution: "GA",
    }).fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    const ids = races.map((r) => r.id).sort();
    expect(ids.filter((i) => i.startsWith("house:GA-")).length).toBe(14);
    expect(ids).not.toContain("president");
    const h5 = races.find((r) => r.id === "house:GA-05")!;
    expect(h5.status).toBe("certified");
    expect(h5.candidates.every((c) => !/\(Dem\)|\(Rep\)/.test(c.name))).toBe(true);
    expect(h5.candidates.find((c) => c.party === "D")?.name).toMatch(/Williams/);
    expect(h5.modes?.early).toBeGreaterThan(0); // "Advanced Voting"
    expect(h5.modes?.mail).toBeGreaterThan(0); // "Absentee by Mail"
    const fulton = h5.units.find((u) => u.fips === "13121")!;
    expect(fulton.name).toBe("Fulton County");
    expect(fulton.totalVotes).toBe(sumVotes(fulton.votes));
    expect(fulton.precinctsTotal).toBeGreaterThan(0);
  });
});
