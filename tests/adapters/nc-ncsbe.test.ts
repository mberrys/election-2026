import { describe, expect, it } from "vitest";
import { makeNcAdapter } from "../../src/data/adapters/nc-ncsbe";
import { Race } from "../../src/data/schema";
import { fixture, fixtureFetch, makeCtx, meta, sumVotes } from "./helpers";

const metas = [
  meta({
    id: "senate:NC",
    office: "senate",
    state: "NC",
    name: "NC Senate",
    candidates: [
      { id: "cooper-roy", name: "Roy Cooper", party: "D", aliases: [] },
      { id: "whatley-michael", name: "Michael Whatley", party: "R", aliases: [] },
    ],
  }),
];

describe("nc-ncsbe (2026 staged)", () => {
  const fetchStub = fixtureFetch([
    ["/enr/20261103/data/results_0.txt", fixture("nc/results_0.2026.txt")],
    ["/enr/20261103/data/results_1.txt", fixture("nc/results_1.2026.txt")],
    ["/enr/20261103/data/results_92.txt", fixture("nc/results_92.2026.txt")],
  ]);

  it("resolves senate + 14 house races, zero votes → not_started, county units from per-county files", async () => {
    const ctx = makeCtx(fetchStub, metas);
    const races = await makeNcAdapter({ concurrency: 4 }).fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();

    const ids = races.map((r) => r.id).sort();
    expect(ids).toContain("senate:NC");
    for (let d = 1; d <= 14; d++) expect(ids).toContain(`house:NC-${String(d).padStart(2, "0")}`);
    expect(ids.some((i) => i.startsWith("stateleg") || /SUPREME/i.test(i))).toBe(false);

    const sen = races.find((r) => r.id === "senate:NC")!;
    expect(sen.status).toBe("not_started");
    expect(sen.precinctsTotal).toBe(2626);
    expect(sen.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["cooper-roy", "whatley-michael"]));
    expect(sen.candidates.find((c) => c.id === "cooper-roy")?.party).toBe("D");
    expect(sen.candidates.find((c) => c.name === "Shannon W. Bray")?.party).toBe("L");
    expect(sen.candidates.find((c) => c.name === "Michael Dublin")?.party).toBe("G");
    expect(sen.source).toMatchObject({ adapter: "nc-ncsbe", tier: "A" });

    // Only two county files were served; the other 98 404 and are logged, not fatal.
    expect(sen.units.map((u) => u.fips).sort()).toEqual(["37001", "37183"]);
    const wake = sen.units.find((u) => u.fips === "37183")!;
    expect(wake.name).toBe("Wake");
    expect(wake.precinctsTotal).toBe(216);
    expect(ctx.logs.filter((l) => /unavailable/.test(l)).length).toBe(98);
    expect(fetchStub.calls.length).toBe(101);
  });
});

describe("nc-ncsbe (2024 general, real votes)", () => {
  const fetchStub = fixtureFetch([
    ["/enr/20241105/data/results_0.txt", fixture("nc/results_0.2024.txt")],
    ["/enr/20241105/data/results_1.txt", fixture("nc/results_1.2024.txt")],
    ["/enr/20241105/data/results_92.txt", fixture("nc/results_92.2024.txt")],
  ]);

  it("sums totals, exposes vote-method modes, and county units carry fips + modes", async () => {
    const ctx = makeCtx(fetchStub);
    const races = await makeNcAdapter({ electionDate: "20241105", concurrency: 8 }).fetch(ctx);
    const gov = races.find((r) => r.id === "governor:NC")!;
    expect(gov).toBeDefined();
    expect(gov.status).toBe("counting");
    expect(gov.precinctsReporting).toBe(gov.precinctsTotal);
    expect(gov.totalVotes).toBe(gov.candidates.reduce((s, c) => s + c.votes, 0));
    expect(gov.leaderId).toBe("stein-josh");
    expect(gov.candidates[0]?.party).toBe("D");
    expect(gov.marginDR).toBeGreaterThan(10);

    // NC modes: ovc one-stop (early), evc election day, avc mail, pvc provisional; they sum to vct.
    expect(gov.modes).toBeDefined();
    const m = gov.modes!;
    expect((m.early ?? 0) + (m.electionDay ?? 0) + (m.mail ?? 0) + (m.provisional ?? 0)).toBe(gov.totalVotes);
    expect(m.early!).toBeGreaterThan(m.electionDay!);

    const h1 = races.find((r) => r.id === "house:NC-01")!;
    expect(h1.candidates.find((c) => c.party === "D")?.name).toMatch(/Davis/);

    const wake = gov.units.find((u) => u.fips === "37183")!;
    expect(wake.level).toBe("county");
    expect(wake.totalVotes).toBe(sumVotes(wake.votes));
    expect(wake.totalVotes).toBeGreaterThan(500_000);
    expect(wake.complete).toBe(true);
    expect(wake.modes).toBeDefined();
    expect(wake.margin).toBeGreaterThan(0);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
  });
});
