import { describe, expect, it } from "vitest";
import { akDistrictOf, makeAkAdapter, parseCsv } from "../../src/data/adapters/ak-doe";
import { Race } from "../../src/data/schema";
import { fixture, fixtureFetch, makeCtx, meta, sumVotes } from "./helpers";

describe("ak-doe", () => {
  it("csv parser handles quoted commas and doubled quotes", () => {
    const rows = parseCsv('a,b,c\r\n"x, y",2,"He said ""hi"""\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", "2", 'He said "hi"'],
    ]);
    expect(akDistrictOf("01-600")).toBe("01");
    expect(akDistrictOf("99")).toBe("99");
  });

  it("senate / at-large house / governor; House-district localities; method modes; RCV note", async () => {
    const fetchStub = fixtureFetch([["GA_ENR_Precinct_State_of_Alaska.csv", fixture("ak/GA_ENR_Precinct_State_of_Alaska.2026.truncated.csv")]]);
    const metas = [
      meta({
        id: "senate:AK",
        office: "senate",
        state: "AK",
        name: "AK Senate",
        candidates: [
          { id: "peltola-mary", name: "Mary Peltola", party: "D", aliases: [] },
          { id: "sullivan-dan", name: "Dan Sullivan", party: "R", incumbent: true, aliases: ["Dan S. Sullivan"] },
        ],
      }),
    ];
    const ctx = makeCtx(fetchStub, metas);
    const races = await makeAkAdapter().fetch(ctx);
    for (const r of races) expect(() => Race.parse(r)).not.toThrow();
    expect(races.map((r) => r.id).sort()).toEqual(["governor:AK", "house:AK-AL", "senate:AK"]);

    const sen = races.find((r) => r.id === "senate:AK")!;
    expect(sen.source.attribution).toMatch(/RCV first choices/);
    expect(sen.totalVotes).toBe(sen.candidates.reduce((s, c) => s + c.votes, 0));
    expect(sen.totalVotes).toBe(sen.units.reduce((s, u) => s + u.totalVotes, 0));
    // "Last, First" flipped and matched to metas; a same-surname spoiler ("Sullivan, Daniel J. Jr.", no party)
    // must not steal the incumbent's id.
    expect(sen.candidates.find((c) => c.id === "peltola-mary")?.name).toBe("Mary Peltola");
    const dan = sen.candidates.find((c) => c.id === "sullivan-dan")!;
    expect(dan.name).toBe("Dan Sullivan");
    expect(dan.incumbent).toBe(true);
    expect(dan.votes).toBeGreaterThan(10_000);
    const spoiler = sen.candidates.find((c) => c.id === "sullivan-daniel")!;
    expect(spoiler.party).toBe("O");
    expect(spoiler.votes).toBeLessThan(dan.votes);
    expect(sen.leaderId).toBe("peltola-mary");
    expect(sen.candidates.find((c) => /Hafner/.test(c.name))?.name).toBe('Carol "Kitty" Hafner'); // display keeps nickname
    expect(sen.candidates.find((c) => /Hafner/.test(c.name))?.party).toBe("D");
    expect(sen.candidates.find((c) => /Hill/.test(c.name))?.party).toBe("I"); // UND
    // Units are House districts (locality level), ids AK-HDnn, with method split
    expect(sen.units.every((u) => u.level === "locality" && /^AK-HD\d{2}$/.test(u.id) && !u.fips)).toBe(true);
    expect(sen.units.map((u) => u.id)).toContain("AK-HD01");
    expect(sen.units.map((u) => u.id)).toContain("AK-HD99");
    const hd1 = sen.units.find((u) => u.id === "AK-HD01")!;
    expect(hd1.name).toBe("House District 1");
    expect(hd1.totalVotes).toBe(sumVotes(hd1.votes));
    expect(hd1.precinctsTotal).toBeGreaterThan(0);
    expect(hd1.precinctsReporting).toBe(0); // Reporting_flag 0 everywhere in the staged file
    const m = sen.modes!;
    expect((m.early ?? 0) + (m.mail ?? 0) + (m.electionDay ?? 0) + (m.provisional ?? 0)).toBeGreaterThan(0);
    expect(hd1.modes?.electionDay).toBeGreaterThan(0);
    // Test-data file has non-zero votes but no precincts flagged; still "counting", never "not_started"
    expect(sen.status).toBe("counting");
  });
});
