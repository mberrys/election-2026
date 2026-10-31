import { describe, expect, it } from "vitest";
import { fromDetailXml, makeClarityAdapter } from "../../src/data/adapters/clarity";
import { readZipEntry } from "../../src/data/adapters/util/zip";
import { Race } from "../../src/data/schema";
import { fixture, fixtureBytes, fixtureFetch, makeCtx, meta, sumVotes } from "./helpers";

const ROOT = "https://results.enr.clarityelections.com/IA";

describe("clarity (IA)", () => {
  const metas = [
    meta({
      id: "senate:IA",
      office: "senate",
      state: "IA",
      name: "IA Senate",
      candidates: [
        { id: "hinson-ashley", name: "Ashley Hinson", party: "R", aliases: [] },
        { id: "turek-josh", name: "Josh Turek", party: "D", aliases: [] },
      ],
    }),
  ];

  it("2026 staged via JSON endpoints: version → summary + details → county units with fips", async () => {
    const fetchStub = fixtureFetch([
      [`${ROOT}/127077/current_ver.txt`, fixture("ia/current_ver.2026.txt")],
      [`${ROOT}/127077/382865/json/en/summary.json`, fixture("ia/summary.2026.json")],
      [`${ROOT}/127077/382865/json/details.json`, fixture("ia/details.2026.json")],
    ]);
    const ctx = makeCtx(fetchStub, metas);
    const races = await makeClarityAdapter({ id: "clarity-ia", state: "IA", eid: "127077", tier: "A", attribution: "Iowa SoS" }).fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    expect(races.map((r) => r.id).sort()).toEqual(["governor:IA", "house:IA-01", "house:IA-02", "house:IA-03", "house:IA-04", "senate:IA"]);
    const sen = races.find((r) => r.id === "senate:IA")!;
    expect(sen.status).toBe("not_started");
    expect(sen.precinctsTotal).toBe(1666);
    expect(sen.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["hinson-ashley", "turek-josh", "write-in"]));
    expect(sen.candidates.find((c) => c.id === "turek-josh")?.party).toBe("D");
    expect(sen.candidates.find((c) => /Laehn/.test(c.name))?.party).toBe("L");
    expect(sen.units.length).toBe(99);
    expect(sen.units.every((u) => u.fips?.startsWith("19"))).toBe(true);
    expect(sen.units.find((u) => u.name === "O'Brien")?.fips).toBe("19141");
    expect(sen.units.find((u) => u.name === "Polk")?.precinctsTotal).toBe(176);
    expect(fetchStub.calls.length).toBe(3);
  });

  it("2024 general via JSON: totals and county sums match", async () => {
    const fetchStub = fixtureFetch([
      [`${ROOT}/122322/current_ver.txt`, fixture("ia/current_ver.2024.txt")],
      [`${ROOT}/122322/356043/json/en/summary.json`, fixture("ia/summary.2024.json")],
      [`${ROOT}/122322/356043/json/details.json`, fixture("ia/details.2024.json")],
    ]);
    const ctx = makeCtx(fetchStub);
    const races = await makeClarityAdapter({ id: "clarity-ia", state: "IA", eid: "122322", tier: "A", attribution: "Iowa SoS" }).fetch(ctx);
    const h1 = races.find((r) => r.id === "house:IA-01")!;
    expect(h1.status).toBe("counting");
    expect(h1.totalVotes).toBe(h1.units.reduce((s, u) => s + u.totalVotes, 0));
    expect(h1.candidates.find((c) => c.party === "R")?.name).toMatch(/Miller-Meeks/);
    expect(Math.abs(h1.marginDR!)).toBeLessThan(1); // IA-01 2024 decided by ~800 votes
    const polk = races.find((r) => r.id === "house:IA-03")!.units.find((u) => u.fips === "19153")!;
    expect(polk.totalVotes).toBe(sumVotes(polk.votes));
    expect(polk.complete).toBe(true);
    expect(races.some((r) => /president/i.test(r.name))).toBe(false);
  });

  it("falls back to reports/detailxml.zip (built-in zip + xml parser) and exposes vote-type modes", async () => {
    const fetchStub = fixtureFetch([
      [`${ROOT}/127077/current_ver.txt`, fixture("ia/current_ver.2026.txt")],
      [`${ROOT}/127077/382865/json/en/summary.json`, { status: 403 }],
      [`${ROOT}/127077/382865/reports/detailxml.zip`, fixtureBytes("ia/detailxml.2026.zip")],
    ]);
    const ctx = makeCtx(fetchStub, metas);
    const races = await makeClarityAdapter({ id: "clarity-ia", state: "IA", eid: "127077", tier: "A", attribution: "Iowa SoS" }).fetch(ctx);
    expect(races.map((r) => r.id).sort()).toEqual(["governor:IA", "house:IA-01", "house:IA-02", "house:IA-03", "house:IA-04", "senate:IA"]);
    const sen = races.find((r) => r.id === "senate:IA")!;
    expect(sen.units.length).toBe(99);
    expect(sen.units.find((u) => u.name === "Black Hawk")?.fips).toBe("19013");
    expect(sen.units.find((u) => u.name === "Black Hawk")?.precinctsTotal).toBe(59);
    expect(sen.source.url).toMatch(/detailxml\.zip$/);
    expect(sen.candidates.map((c) => c.id)).toContain("hinson-ashley");

    const xml = new TextDecoder().decode(readZipEntry(fixtureBytes("ia/detailxml.2026.zip"), "detail.xml")!);
    const contests = fromDetailXml(xml);
    const usSen = contests.find((c) => c.key === "1000")!;
    expect(usSen.name).toBe("United States Senator");
    expect(usSen.choices.map((c) => c.name)).toEqual(["Ashley Hinson", "Josh Turek", "Thomas Laehn", "Write-in"]);
    expect(Object.keys(usSen.choices[0]!.modes!).sort()).toEqual(["electionDay", "mail"]);
  });
});
