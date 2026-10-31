import { describe, expect, it } from "vitest";
import {
  classifyMiContest,
  claritySource,
  evSource,
  makeMiCountiesAdapter,
  parseTotalVote,
  wayneSource,
} from "../../src/data/adapters/mi-counties";
import { HOUSE_COUNTIES, stateCountyFips } from "../../src/data/adapters/az-mi-wa-shared";
import { runAdapters } from "../../src/data/adapters/types";
import { Race, type RaceMeta } from "../../src/data/schema";
import { getRace } from "../../src/data/reference/load";
import { fixture, fixtureFetch, makeCtx, meta, sumVotes } from "./helpers";

const EV = "https://app.enhancedvoting.com/results/public/api";
const WAYNE = "https://michigan.totalvote.com/Wayne/ResultsSW.aspx";

describe("classifyMiContest", () => {
  it.each([
    ["Governor and Lieutenant Governor", "governor:MI"],
    ["Governor & Lieutenant Governor", "governor:MI"],
    ["Governor and Lt. Governor", "governor:MI"],
    ["Governor and Lieutenant Governor - VOTE FOR ONE (1)", "governor:MI"],
    ["United States Senator", "senate:MI"],
    ["Representative in Congress 4th District", "house:MI-04"],
    ["Representative in Congress - 2nd District", "house:MI-02"],
    ["Representative in Congress District 7", "house:MI-07"],
    ["Representative in Congress, 1st District", "house:MI-01"],
    ["State Proposal 2026-1", "ballot:MI-proposal-1"],
    ["State Proposal 2026-02", "ballot:MI-proposal-2"],
    ["Proposal 2026-2 - State of Michigan", "ballot:MI-proposal-2"],
    ["Proposal 2026-1 Constitutional Convention - VOTE FOR ONE (1)", "ballot:MI-proposal-1"],
  ])("%s → %s", (name, id) => expect(classifyMiContest(name)?.id).toBe(id));

  it.each([
    "Governor of Wayne State University",
    "Wayne State University Governor",
    "State Senator 12th District",
    "Representative in State Legislature 37th District",
    "Camden-Frontier School Sinking Fund Millage Proposal",
  ])("%s → null", (name) => expect(classifyMiContest(name)).toBeNull());
});

describe("parseTotalVote (Wayne)", () => {
  it("reads contests, candidates, parties and precinct counts", () => {
    const con = parseTotalVote(fixture("mi/wayne-CON.html"));
    const sen = con.find((c) => /^United States Senator/.test(c.name))!;
    expect(sen.precinctsTotal).toBe(770);
    expect(sen.choices.find((c) => /Rogers/.test(c.name))?.party).toBe("R");
    expect(sen.choices.find((c) => /El-Sayed/.test(c.name))?.party).toBe("D");
    expect(con.filter((c) => /^Representative in Congress/.test(c.name))).toHaveLength(3);
  });
});

const routes2026 = fixtureFetch([
  [`${EV}/elections/kent-county-mi/11032026_20261005115447/ballot-items`, fixture("mi/ev-ballot-items.kent.2026.json")],
  [`${EV}/elections/branch-county-mi/2026NovemberGeneral/ballot-items`, fixture("mi/ev-ballot-items.branch.2026.json")],
  [`${EV}/jurisdictions/kent-county-mi`, fixture("mi/ev-jurisdictions.kent.json")],
  [/\/MI\/Oakland\/127284\/current_ver\.txt$/, fixture("mi/clarity-oakland.current_ver.txt")],
  [/\/MI\/Oakland\/127284\/\d+\/json\/en\/summary\.json$/, fixture("mi/clarity-oakland.summary.json")],
  [/\/MI\/Macomb\/127293\/current_ver\.txt$/, fixture("mi/clarity-macomb.current_ver.txt")],
  [/\/MI\/Macomb\/127293\/\d+\/json\/en\/summary\.json$/, fixture("mi/clarity-macomb.summary.json")],
  [`${WAYNE}?type=ST&cid=05&map=CTY`, fixture("mi/wayne-ST.html")],
  [`${WAYNE}?type=CON&cid=05&map=CTY`, fixture("mi/wayne-CON.html")],
  [`${WAYNE}?type=PRP&cid=05&map=CTY`, fixture("mi/wayne-PRP.html")],
]);

const metas2026 = ["senate:MI", "governor:MI", "house:MI-03", "house:MI-06", "house:MI-11", "ballot:MI-proposal-1"].map((id) => getRace(id)!);
const COVERED = new Set(["26081", "26023", "26125", "26099", "26163"]); // Kent, Branch, Oakland, Macomb, Wayne

describe("mi-counties 2026 (staged; 5 counties + one dead feed)", () => {
  const sources = [
    evSource("kent-county-mi", "stale-slug"), // 404 → slug rediscovered from the jurisdiction list
    evSource("branch-county-mi", "2026NovemberGeneral"),
    evSource("lake-county-mi", "Nov-26-General"), // not stubbed: must be padded, not dropped
    claritySource("Oakland", "127284"),
    claritySource("Macomb", "127293"),
    wayneSource,
  ];

  it("assembles statewide races from the counties present, pads the rest, logs coverage", async () => {
    const ctx = makeCtx(routes2026, metas2026);
    const races = await makeMiCountiesAdapter(sources).fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    const ids = races.map((r) => r.id);
    for (const id of ["senate:MI", "governor:MI", "ballot:MI-proposal-1", "ballot:MI-proposal-2", "house:MI-03", "house:MI-06", "house:MI-11", "house:MI-12", "house:MI-13"]) {
      expect(ids).toContain(id);
    }
    expect(ctx.logs.some((l) => /kent-county-mi: slug stale-slug 404, using discovered 11032026_20261005115447/.test(l))).toBe(true);
    expect(ctx.logs.some((l) => /^Lake \(ev\) failed: .*counted as not reporting/.test(l))).toBe(true);
    expect(ctx.logs.some((l) => /covered 5\/83 counties: Branch, Kent, Macomb, Oakland, Wayne/.test(l))).toBe(true);

    const sen = races.find((r) => r.id === "senate:MI")!;
    expect(sen.source).toMatchObject({ adapter: "mi-counties", tier: "B" });
    expect(sen.source.attribution).toMatch(/Michigan county clerks .*partial: 5 of 83 counties/);
    expect(sen.units.map((u) => u.fips).sort()).toEqual(stateCountyFips("MI"));
    for (const u of sen.units) {
      expect(u.fips).toMatch(/^26\d{3}$/);
      expect(u.precinctsReporting).toBe(0);
      expect(u.complete).not.toBe(true);
      if (COVERED.has(u.fips!)) expect(u.precinctsTotal).toBeGreaterThan(0);
      else expect(u.precinctsTotal).toBeUndefined();
    }
    expect(sen.units.find((u) => u.fips === "26163")).toMatchObject({ name: "Wayne County", precinctsTotal: 770 });
    expect(sen.precinctsTotal).toBeUndefined();
    // Every candidate resolves to a RaceMeta id whatever the feed spelling ("DEM Abdul El-Sayed", "Abdul El-Sayed").
    const metaIds = new Set(getRace("senate:MI")!.candidates.map((c) => c.id));
    for (const c of sen.candidates) expect(metaIds.has(c.id) || c.id === "write-in").toBe(true);

    const gov = races.find((r) => r.id === "governor:MI")!;
    expect(gov.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["benson-jocelyn", "james-john"]));
    expect(gov.candidates.some((c) => /akeel|anuzis/.test(c.id))).toBe(false); // WSU Board of Governors excluded

    // Oakland (Clarity) and Wayne (TotalVote) spell the Libertarian "Teagan"; RaceMeta has "Tegan" → one id.
    const h6 = races.find((r) => r.id === "house:MI-06")!;
    expect(h6.candidates.map((c) => c.id)).toContain("tegan-timothy");
    expect(h6.candidates.some((c) => c.id === "teagan-timothy")).toBe(false);
    // MI-06 = Washtenaw + Wayne (+ Oakland, which reports it): Washtenaw has no feed → padded.
    expect(h6.units.find((u) => u.fips === "26161")).toMatchObject({ totalVotes: 0, precinctsReporting: 0 });

    const h11 = races.find((r) => r.id === "house:MI-11")!;
    expect(h11.units.map((u) => u.fips)).toEqual(HOUSE_COUNTIES["house:MI-11"]);
    expect(h11.source.attribution).not.toMatch(/partial/);
    expect(h11.precinctsTotal).toBeGreaterThan(0);
  });

  it("runs under runAdapters with isolation", async () => {
    const { races, feeds } = await runAdapters([makeMiCountiesAdapter(sources)], {
      fetch: routes2026,
      now: new Date("2026-11-03T20:00:00Z"),
      metas: new Map(metas2026.map((m) => [m.id, m])),
    });
    expect(feeds[0]).toMatchObject({ adapter: "mi-counties", ok: true });
    expect(races.length).toBeGreaterThan(10);
  });

  it("fails loudly only when every county feed is down", async () => {
    const ctx = makeCtx(fixtureFetch([]), metas2026);
    await expect(makeMiCountiesAdapter(sources).fetch(ctx)).rejects.toThrow(/no Michigan county feed/);
  });
});

describe("mi-counties 2024 general (Kent + Branch certified, same API)", () => {
  const stub = fixtureFetch([
    [`${EV}/elections/kent-county-mi/2024KentCountyGeneral/ballot-items`, fixture("mi/ev-ballot-items.kent.2024.json")],
    [`${EV}/elections/branch-county-mi/2024generalelection/ballot-items`, fixture("mi/ev-ballot-items.branch.2024.json")],
  ]);
  const sen2024: RaceMeta = meta({
    id: "senate:MI",
    office: "senate",
    state: "MI",
    name: "MI U.S. Senate",
    candidates: [
      { id: "slotkin-elissa", name: "Elissa Slotkin", party: "D" },
      { id: "rogers-mike", name: "Mike Rogers", party: "R" },
    ],
  });

  it("sums county totals exactly; AV counting boards land in mail; 81 counties outstanding", async () => {
    const ctx = makeCtx(stub, [sen2024]);
    const adapter = makeMiCountiesAdapter([
      evSource("kent-county-mi", "2024KentCountyGeneral"),
      evSource("branch-county-mi", "2024generalelection"),
    ]);
    const races = await adapter.fetch(ctx);
    const sen = races.find((r) => r.id === "senate:MI")!;
    expect(sen.candidates.find((c) => c.id === "slotkin-elissa")?.votes).toBe(187509 + 5922);
    expect(sen.candidates.find((c) => c.id === "rogers-mike")?.votes).toBe(170388 + 14181);
    expect(sen.totalVotes).toBe(sen.units.reduce((s, u) => s + u.totalVotes, 0));
    for (const u of sen.units) expect(u.totalVotes).toBe(sumVotes(u.votes));
    const kent = sen.units.find((u) => u.fips === "26081")!;
    expect(kent).toMatchObject({ precinctsReporting: 240, precinctsTotal: 240, complete: true });
    expect(kent.modes?.mail).toBeGreaterThan(85347); // Slotkin's AV-counting-board votes alone
    expect(sen.units.filter((u) => u.totalVotes === 0 && u.precinctsReporting === 0)).toHaveLength(81);
    expect(sen.status).toBe("counting");

    const h5 = races.find((r) => r.id === "house:MI-05")!;
    expect(h5.units).toHaveLength(HOUSE_COUNTIES["house:MI-05"]!.length);
    expect(h5.units.find((u) => u.fips === "26023")!.totalVotes).toBe(5102 + 15265 + 309);
    expect(races.find((r) => r.id === "house:MI-03")!.units.map((u) => u.fips)).toEqual(HOUSE_COUNTIES["house:MI-03"]);
  });
});
