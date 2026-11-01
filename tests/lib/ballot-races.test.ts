import { describe, expect, it } from "vitest";
import {
  buildBallotIndex,
  countdownText,
  designations,
  districtLabel,
  districtNumber,
  expandIndex,
  groupContests,
  matchContest,
  measureLabel,
  parseRaceId,
  raceHref,
  splitPlace,
  stateFromAddress,
  type RaceRef,
} from "../../src/components/ballot/ballot-races";
import { raceSlug } from "../../src/components/race/race-content";
import { loadRaces, loadStates } from "../../src/data/reference/load";
import type { Contest } from "../../src/lib/civic";

const C = (c: Partial<Contest> & Pick<Contest, "title">): Contest => ({ kind: "candidate", candidates: [], ...c });

const index = buildBallotIndex(loadRaces(), loadStates());
const races = expandIndex(index);
const id = (r?: RaceRef) => r?.id;

describe("index", () => {
  it("keeps Senate, governor, House and ballot races, not state legislatures", () => {
    expect(index.races).toContain("senate:GA");
    expect(index.races).toContain("house:TX-15");
    expect(index.races.some((r) => r.startsWith("stateleg:"))).toBe(false);
    expect(index.measures["ballot:CA-prop-1"]).toMatch(/Proposition 1/);
    expect(races).toHaveLength(index.races.length);
  });

  it("parses ids", () => {
    expect(parseRaceId("house:TX-15")).toMatchObject({ office: "house", state: "TX", district: "15", special: false });
    expect(parseRaceId("senate:FL-special")).toMatchObject({ office: "senate", state: "FL", special: true });
    expect(parseRaceId("stateleg:MI-house")).toBeUndefined();
  });

  it("links with the same slug rule as the race pages", () => {
    for (const r of ["senate:GA", "house:TX-15", "governor:AZ", "senate:OH-special", "ballot:CA-prop-1"]) {
      expect(raceHref(r)).toBe(`/race/${raceSlug({ id: r })}`);
    }
    expect(raceHref("house:TX-15")).toBe("/race/house-tx-15");
  });
});

describe("matchContest", () => {
  it("matches the Senate race by state", () => {
    expect(id(matchContest(C({ title: "U.S. Senate", level: "country", district: "Georgia" }), races, { state: "GA" }))).toBe("senate:GA");
    expect(id(matchContest(C({ title: "United States Senator", districtId: "ocd-division/country:us/state:tx" }), races))).toBe("senate:TX");
  });

  it("matches a state's only Senate race even when it is a special", () => {
    expect(id(matchContest(C({ title: "U.S. Senate", level: "country", special: true }), races, { state: "OH" }))).toBe("senate:OH-special");
  });

  it("does not treat a state senate seat as the U.S. Senate", () => {
    expect(matchContest(C({ title: "State Senate District 12", level: "administrativeArea1" }), races, { state: "GA" })).toBeUndefined();
    expect(matchContest(C({ title: "State Senator", district: "District 12" }), races, { state: "GA" })).toBeUndefined();
  });

  it("matches House districts from the OCD id, the district name or the title", () => {
    expect(id(matchContest(C({ title: "U.S. Representative", level: "country", districtId: "ocd-division/country:us/state:tx/cd:15" }), races))).toBe("house:TX-15");
    expect(id(matchContest(C({ title: "U.S. House", level: "country", district: "California's 1st congressional district" }), races, { state: "CA" }))).toBe(
      "house:CA-01",
    );
    expect(id(matchContest(C({ title: "Representative in Congress, District 7" }), races, { state: "PA" }))).toBe("house:PA-07");
  });

  it("matches at-large seats without a number and refuses House contests with no district", () => {
    expect(id(matchContest(C({ title: "U.S. Representative", level: "country" }), races, { state: "AK" }))).toBe("house:AK-AL");
    expect(matchContest(C({ title: "U.S. Representative", level: "country" }), races, { state: "TX" })).toBeUndefined();
    expect(matchContest(C({ title: "State Representative, District 15", level: "administrativeArea1" }), races, { state: "TX" })).toBeUndefined();
  });

  it("matches governor tickets but not lieutenant governor or local contests", () => {
    expect(id(matchContest(C({ title: "Governor", level: "administrativeArea1" }), races, { state: "AZ" }))).toBe("governor:AZ");
    expect(id(matchContest(C({ title: "Governor and Lieutenant Governor" }), races, { state: "GA" }))).toBe("governor:GA");
    expect(matchContest(C({ title: "Lieutenant Governor", level: "administrativeArea1" }), races, { state: "AZ" })).toBeUndefined();
    expect(matchContest(C({ title: "Board of Governors", level: "administrativeArea2" }), races, { state: "AZ" })).toBeUndefined();
  });

  it("matches statewide measures by designation", () => {
    const m = (title: string, st: string, extra: Partial<Contest> = {}) =>
      id(matchContest(C({ kind: "referendum", title, level: "administrativeArea1", ...extra }), races, { state: st }));
    expect(m("Proposition 141", "AZ")).toBe("ballot:AZ-prop-141");
    expect(m("Prop. 1", "CA")).toBe("ballot:CA-prop-1");
    expect(m("Proposition 40", "CA")).toBe("ballot:CA-propostion-40");
    expect(m("State Question 845", "OK")).toBe("ballot:OK-question-845");
    expect(m("Amendment 81", "CO")).toBe("ballot:CO-amendment-81");
    expect(m("Constitutional Amendment J", "SD")).toBe("ballot:SD-constitutional-amendment-j");
    expect(m("Proposition A", "MO")).toBe("ballot:MO-proposition-a");
    expect(m("CI-132", "MT")).toBe("ballot:MT-ci-132");
    expect(m("Issue 3", "OH")).toBe("ballot:OH-issue-3");
  });

  it("falls back to a strict name match for measures without a number", () => {
    const m = (title: string, st: string, brief?: string) =>
      id(matchContest(C({ kind: "referendum", title, brief, level: "administrativeArea1" }), races, { state: st, stateName: loadStates().find((s) => s.abbr === st)?.name }));
    expect(m("Amendment 1", "AL", "Broadcast the Star-Spangled Banner in public schools")).toBe("ballot:AL-broadcast-the-star-spangled-banner");
    expect(m("Allow and regulate online sports wagering", "NE")).toBe("ballot:NE-allow-and-regulate-online-sports");
    expect(m("Amendment 1", "AL")).toBeUndefined();
    expect(m("Bond for parks", "AL")).toBeUndefined();
  });

  it("never matches a local measure to a statewide one", () => {
    expect(matchContest(C({ kind: "referendum", title: "Proposition 1", level: "administrativeArea2" }), races, { state: "CA" })).toBeUndefined();
    expect(
      matchContest(C({ kind: "referendum", title: "Proposition 1", districtId: "ocd-division/country:us/state:ca/county:los_angeles" }), races, { state: "CA" }),
    ).toBeUndefined();
  });

  it("needs a state", () => {
    expect(matchContest(C({ title: "U.S. Senate", level: "country" }), races)).toBeUndefined();
  });
});

describe("helpers", () => {
  it("reads designations", () => {
    expect(designations("Prop. 50")).toEqual(["prop:50"]);
    expect(designations("State Question 845, Changes to Judicial Nominating Commission Amendment")).toEqual(["question:845"]);
    expect(designations("Montana I-194, Exclude Political Spending")).toEqual(["i:194"]);
    expect(designations("Initiative No. 2117")).toEqual(["initiative:2117"]);
    expect(designations("Amendment to the constitution")).toEqual([]);
    expect(designations("Utah 60% Vote Requirement for Ballot Initiatives to Increase Taxes")).toEqual([]);
  });

  it("reads district numbers", () => {
    expect(districtNumber(C({ title: "U.S. House", district: "Georgia's 5th congressional district" }))).toBe(5);
    expect(districtNumber(C({ title: "U.S. Representative, District 05" }))).toBe(5);
    expect(districtNumber(C({ title: "U.S. Representative" }))).toBeUndefined();
  });

  it("splits measure names into a designation and a description", () => {
    expect(measureLabel("Arizona Proposition 141, Prohibit Taxes or Fees on Miles Traveled", "Arizona")).toEqual({ lead: "Proposition 141", rest: "Prohibit Taxes or Fees on Miles Traveled" });
    expect(measureLabel("Proposition 1: California Veteran and Housing Assistance Programs Bond Measure", "California")).toEqual({
      lead: "Proposition 1",
      rest: "Veteran and Housing Assistance Programs Bond Measure",
    });
    expect(measureLabel("Michigan Proposal 2", "Michigan")).toEqual({ lead: "Proposal 2", rest: "" });
    expect(measureLabel("Montana CI-132, Require Nonpartisan Judicial Elections Initiative", "Montana")).toEqual({ lead: "CI-132", rest: "Require Nonpartisan Judicial Elections Initiative" });
    expect(measureLabel("Alabama Broadcast The Star-Spangled Banner in Public Schools Amendment", "Alabama")).toEqual({ rest: "Broadcast The Star-Spangled Banner in Public Schools Amendment" });
    expect(measureLabel("2026 Virginia Right to Reproductive Freedom Amendment", "Virginia")).toEqual({ rest: "Right to Reproductive Freedom Amendment" });
  });

  it("labels districts and reads the state from an address", () => {
    expect(districtLabel("01")).toBe("1st District");
    expect(districtLabel("12")).toBe("12th District");
    expect(districtLabel("22")).toBe("22nd District");
    expect(districtLabel("AL")).toBe("At-large");
    expect(stateFromAddress("1 Main St, Austin, TX 78701")).toBe("TX");
    expect(stateFromAddress("somewhere")).toBeUndefined();
  });

  it("splits the location name out of a place's address", () => {
    expect(splitPlace({ address: "Central Library, 1 Margaret Mitchell Sq NW, Atlanta, GA 30303" })).toEqual({
      title: "Central Library",
      address: "1 Margaret Mitchell Sq NW, Atlanta, GA 30303",
    });
    expect(splitPlace({ address: "141 Pryor St SW, Atlanta, GA 30303" })).toEqual({ title: "141 Pryor St SW, Atlanta, GA 30303" });
    expect(splitPlace({ name: "City Hall", address: "City Hall, 301 W 2nd St, Austin, TX 78701" })).toEqual({ title: "City Hall", address: "301 W 2nd St, Austin, TX 78701" });
    expect(splitPlace({ name: "Annex", address: "1 Early Way, Austin, TX" })).toEqual({ title: "Annex", address: "1 Early Way, Austin, TX" });
  });

  it("counts down in days and hours", () => {
    const start = Date.UTC(2026, 10, 3);
    const H = 3_600_000;
    expect(countdownText(start - (2 * 24 + 5) * H - 1, start, start + 24 * H)).toBe("2 days and 5 hours to go.");
    expect(countdownText(start - 24 * H, start, start + 24 * H)).toBe("1 day to go.");
    expect(countdownText(start - 3 * H, start, start + 24 * H)).toBe("3 hours to go.");
    expect(countdownText(start - 1000, start, start + 24 * H)).toBe("Less than an hour to go.");
    expect(countdownText(start + H, start, start + 24 * H)).toBe("today");
    expect(countdownText(start + 25 * H, start, start + 24 * H)).toBe("past");
  });

  it("groups contests in ballot order under level headers", () => {
    const items = [
      { contest: C({ title: "County Sheriff", level: "administrativeArea2" }) },
      { contest: C({ title: "U.S. Senate", level: "country" }) },
      { contest: C({ kind: "referendum", title: "Proposition 1", level: "administrativeArea1" }) },
      { contest: C({ title: "Governor" }), race: parseRaceId("governor:GA") },
      { contest: C({ kind: "referendum", title: "Measure A", districtId: "ocd-division/country:us/state:ca/place:oakland" }) },
    ];
    expect(groupContests(items).map((g) => [g.label, g.items.length])).toEqual([
      ["Federal", 1],
      ["State", 1],
      ["Statewide ballot measures", 1],
      ["County", 1],
      ["Local ballot measures", 1],
    ]);
  });
});
