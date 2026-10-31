import { describe, expect, it } from "vitest";
import { normalizeParty } from "../../src/data/adapters/util/party";
import { resolveContest } from "../../src/data/adapters/util/race-id";
import { candidateSlug, flipLastFirst, matchCandidates, normalizeName } from "../../src/data/adapters/util/names";
import { countyFips, countyName } from "../../src/data/adapters/util/fips";
import { meta } from "./helpers";

describe("party normalization", () => {
  it("maps feed codes to schema parties", () => {
    const cases: [string, string][] = [
      ["DEM", "D"], ["Dem", "D"], ["Democratic", "D"], ["DFL", "D"], ["D", "D"],
      ["REP", "R"], ["Rep", "R"], ["Republican", "R"], ["R", "R"], ["GOP", "R"],
      ["LIB", "L"], ["Libertarian", "L"],
      ["GRN", "G"], ["GRE", "G"], ["GP", "G"], ["Green", "G"],
      ["IND", "I"], ["NPA", "I"], ["NPP", "I"], ["UND", "I"], ["NON", "I"], ["UNA", "I"], ["No Party Preference", "I"],
      ["REP/NON", "R"], ["DEM/NON", "D"],
      ["WI", "O"], ["", "O"], ["RAP", "O"], ["CST", "O"], ["LMN", "O"],
    ];
    for (const [raw, want] of cases) expect(normalizeParty(raw), raw).toBe(want);
    expect(normalizeParty(null)).toBe("O");
  });
});

describe("race id resolution", () => {
  const cases: [string, string, string | null][] = [
    ["US SENATE (VOTE FOR 1)", "NC", "senate:NC"],
    ["US HOUSE OF REPRESENTATIVES DISTRICT 01 (VOTE FOR 1)", "NC", "house:NC-01"],
    ["US HOUSE OF REPRESENTATIVES DISTRICT 14 (VOTE FOR 1)", "NC", "house:NC-14"],
    ["NC GOVERNOR (VOTE FOR 1)", "NC", "governor:NC"],
    ["NC LIEUTENANT GOVERNOR (VOTE FOR 1)", "NC", null],
    ["NC STATE SENATE DISTRICT 01 (VOTE FOR 1)", "NC", null],
    ["NC SUPREME COURT ASSOCIATE JUSTICE SEAT 01 (VOTE FOR 1)", "NC", null],
    ["Member, United States Senate", "VA", "senate:VA"],
    ["Member, House of Representatives (1st District)", "VA", "house:VA-01"],
    ["Member, House of Representatives (11th District)", "VA", "house:VA-11"],
    ["Member, House of Delegates (20th District)", "VA", null],
    ["Governor", "VA", "governor:VA"],
    ["Lieutenant Governor", "VA", null],
    ["US House of Representatives - District 5", "GA", "house:GA-05"],
    ["President of the US", "GA", null],
    ["US Senate (Special)", "OH", "senate:OH-special"],
    ["United States Senator", "IA", "senate:IA"],
    ["United States Representative District 3", "IA", "house:IA-03"],
    ["Governor and Lt. Governor", "IA", "governor:IA"],
    ["State Senator District 1", "IA", null],
    ["U.S. Senator", "MN", "senate:MN"],
    ["U.S. Representative District 8", "MN", "house:MN-08"],
    ["Governor & Lt Governor", "MN", "governor:MN"],
    ["State Representative District 10A", "MN", null],
    ["U.S. Senator", "AK", "senate:AK"],
    ["U.S. Representative", "AK", "house:AK-AL"],
    ["Governor / Lieutenant Governor", "AK", "governor:AK"],
    ["Senate District A", "AK", null],
    ["House District 12", "AK", null],
    ["Governor - Statewide Results", "CA", "governor:CA"],
    ["U.S. House of Representatives District 13 - Districtwide Results", "CA", "house:CA-13"],
    ["US HOUSE OF REPRESENTATIVES", "NC", null], // no district → ambiguous → skip
    ["U.S. Senate", "GA", "senate:GA"],
  ];
  for (const [name, st, want] of cases) {
    it(`${st}: "${name}" → ${want}`, () => {
      expect(resolveContest(name, st)?.id ?? null).toBe(want);
    });
  }
  it("flags specials", () => {
    expect(resolveContest("United States Senator (Unexpired Term)", "FL")?.special).toBe(true);
    expect(resolveContest("United States Senator", "FL")?.special).toBe(false);
  });
});

describe("candidate names", () => {
  it("normalizes and slugs", () => {
    expect(normalizeName('Hafner, Carol "Kitty"')).toBe("carol hafner");
    expect(normalizeName("Roy A. Cooper")).toBe("roy a cooper");
    expect(normalizeName("Amy Klobuchar and Ben Schierer")).toBe("amy klobuchar");
    expect(normalizeName("Donald J. Trump (Rep)")).toBe("donald j trump");
    expect(normalizeName("Winsome Earle-Sears")).toBe("winsome earle sears");
    expect(flipLastFirst("Sullivan, Daniel J. Jr.")).toBe("Daniel J. Sullivan Jr.");
    expect(candidateSlug("Jon Ossoff")).toBe("ossoff-jon");
    expect(candidateSlug("Peltola, Mary")).toBe("peltola-mary");
    expect(candidateSlug("Write-In (Miscellaneous)")).toBe("write-in");
  });

  it("matches by alias, last name, party, then slug", () => {
    const m = meta({
      id: "senate:NC",
      office: "senate",
      state: "NC",
      name: "NC Senate",
      candidates: [
        { id: "cooper-roy", name: "Roy Cooper", party: "D", aliases: ["Roy A. Cooper"] },
        { id: "whatley-michael", name: "Michael Whatley", party: "R", aliases: [] },
      ],
    });
    const out = matchCandidates(
      [
        { name: "COOPER, ROY A.", party: "D", votes: 10 },
        { name: "Mike Whatley", party: "R", votes: 8 }, // last-name match
        { name: "Shannon W. Bray", party: "L", votes: 1 }, // slug fallback
        { name: "Write-In (Miscellaneous)", party: "O", votes: 1 },
      ],
      m,
    );
    expect(out.map((c) => c.id)).toEqual(["cooper-roy", "whatley-michael", "bray-shannon", "write-in"]);
    expect(out[0]?.name).toBe("Roy Cooper");
  });

  it("falls back to unique party match only when unambiguous", () => {
    const m = meta({
      id: "governor:MN",
      office: "governor",
      state: "MN",
      name: "MN Governor",
      candidates: [
        { id: "klobuchar-amy", name: "Amy J. Klobuchar", party: "D", aliases: [] },
        { id: "demuth-lisa", name: "Lisa Demuth", party: "R", aliases: [] },
      ],
    });
    const out = matchCandidates(
      [
        { name: "A. Klobuchar and Ben Schierer", party: "D", votes: 1 },
        { name: "Demuth and Wilson", party: "R", votes: 1 },
      ],
      m,
    );
    expect(out.map((c) => c.id)).toEqual(["klobuchar-amy", "demuth-lisa"]);
    // Two REPs on the feed side (AK top-4): no party-only match.
    const ak = meta({
      id: "senate:AK",
      office: "senate",
      state: "AK",
      name: "AK Senate",
      candidates: [{ id: "sullivan-dan", name: "Dan Sullivan", party: "R", aliases: [] }],
    });
    const out2 = matchCandidates(
      [
        { name: "Smith, Pat", party: "R", votes: 1 },
        { name: "Jones, Lee", party: "R", votes: 1 },
      ],
      ak,
    );
    expect(out2.map((c) => c.id)).toEqual(["smith-pat", "jones-lee"]);
  });
});

describe("county fips", () => {
  it("resolves names across the covered states", () => {
    expect(countyFips("NC", "Wake")).toBe("37183");
    expect(countyFips("NC", "WAKE COUNTY")).toBe("37183");
    expect(countyFips("VA", "GILES COUNTY")).toBe("51071");
    expect(countyFips("VA", "RICHMOND CITY")).toBe("51760");
    expect(countyFips("VA", "RICHMOND COUNTY")).toBe("51159");
    expect(countyFips("VA", "KING and QUEEN COUNTY")).toBe("51097");
    expect(countyFips("GA", "Fulton County")).toBe("13121");
    expect(countyFips("GA", "DeKalb County")).toBe("13089");
    expect(countyFips("CA", "San Francisco")).toBe("06075");
    expect(countyFips("CA", "Los Angeles")).toBe("06037");
    expect(countyFips("MN", "Hennepin")).toBe("27053");
    expect(countyFips("MN", "Lac qui Parle")).toBe("27073");
    expect(countyFips("IA", "O'Brien")).toBe("19141");
    expect(countyFips("IA", "Black Hawk")).toBe("19013");
    expect(countyFips("AK", "Anchorage")).toBeUndefined();
    expect(countyName("NC", "37001")).toBe("Alamance");
  });
});
