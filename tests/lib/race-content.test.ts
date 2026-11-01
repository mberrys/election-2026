import { describe, expect, it } from "vitest";
import {
  raceCardLines,
  raceCode,
  raceDescription,
  raceHeading,
  raceQa,
  raceSlug,
  raceSubject,
  raceTitle,
  relatedRaces,
  type RaceContentInput,
} from "../../src/components/race/race-content";
import { raceContentInput, racePageSlugs } from "../../src/components/race/race-content-data";
import { getState, loadRaces } from "../../src/data/reference/load";
import type { RaceMeta } from "../../src/data/schema";

const race = (over: Partial<RaceMeta> & Pick<RaceMeta, "id" | "office">): RaceMeta =>
  ({ state: "TX", special: false, name: over.id, candidates: [], ratings: {}, baseline: {}, runoffRule: "none", ...over }) as RaceMeta;

const cand = (id: string, name: string, party: "D" | "R" | "L", incumbent = false) => ({ id, name, party, incumbent, aliases: [] });

const tx: RaceContentInput["state"] = { abbr: "TX", name: "Texas", pollCloseEt: "20:00/21:00", pollCloseFirstEt: "20:00", voteOrder: "unknown" };
const ak: RaceContentInput["state"] = { abbr: "AK", name: "Alaska", pollCloseEt: "20:00", voteOrder: "unknown" };

const senate = race({
  id: "senate:TX",
  office: "senate",
  candidates: [cand("r", "Ray Roe", "R"), cand("d", "Dana Doe", "D"), cand("l", "Lee Lib", "L")],
  ratings: { consensus: "tossup", cook: "tossup", inside: "tilt-d", asOf: "2026-10-30" },
  polls: { d: 49, r: 46.5, n: 20, asOf: "2026-10-28", source: "VoteHub" },
  heldBy: "R",
});
const florida = race({ id: "senate:FL-special", office: "senate", state: "FL", special: true });
const governor = race({ id: "governor:TX", office: "governor" });
const txHouse15 = race({
  id: "house:TX-15",
  office: "house",
  district: "15",
  name: "Texas 15th District",
  candidates: [cand("p", "Bobby Pulido", "D"), cand("c", "Monica De La Cruz", "R", true)],
  ratings: { consensus: "tilt-d" },
  baseline: { presMargin2024: -18 },
});

/** The first question whose text matches `q`, for the given race and state. */
const ask = (meta: RaceMeta, q: RegExp, state: RaceContentInput["state"] = tx) => raceQa({ meta, state }).find((x) => q.test(x.q));

describe("slugs and lookups", () => {
  it("builds lowercase slugs from race ids", () => {
    expect(raceSlug({ id: "senate:TX" })).toBe("senate-tx");
    expect(raceSlug({ id: "house:TX-15" })).toBe("house-tx-15");
    expect(raceSlug({ id: "senate:FL-special" })).toBe("senate-fl-special");
  });

  it("gives 506 unique page slugs that each load their own race", () => {
    const slugs = racePageSlugs();
    expect(slugs).toHaveLength(506);
    expect(new Set(slugs).size).toBe(506);
    for (const slug of slugs) {
      const input = raceContentInput(slug);
      expect(input, slug).toBeDefined();
      expect(raceSlug(input!.meta), slug).toBe(slug);
    }
  });

  it("returns nothing for an unknown slug or a ballot measure", () => {
    const ballot = "ballot-al-broadcast-the-star-spangled-banner";
    expect(loadRaces().some((r) => raceSlug(r) === ballot)).toBe(true);
    expect(raceContentInput("nope")).toBeUndefined();
    expect(raceContentInput(ballot)).toBeUndefined();
  });
});

describe("labels", () => {
  it("gives the short code, heading and subject for each office", () => {
    expect(raceCode(txHouse15)).toBe("TX-15");
    expect(raceCode(senate)).toBe("TX");
    expect(raceHeading(senate, "Texas")).toBe("Texas Senate");
    expect(raceHeading(florida, "Florida")).toBe("Florida Senate special election");
    expect(raceSubject(senate, "Texas")).toBe("the Texas Senate race");
    expect(raceSubject(florida, "Florida")).toBe("the Florida Senate special election");
    expect(raceSubject(txHouse15, "Texas")).toBe("the Texas 15th District House race");
  });
});

describe("raceTitle", () => {
  it("names the office, state and year", () => {
    expect(raceTitle(senate, "Texas")).toBe("Texas Senate Race 2026: Candidates, Polls & Rating");
    expect(raceTitle(florida, "Florida")).toContain("Special Election");
    expect(raceTitle(governor, "Texas")).toBe("Texas Governor Race 2026: Candidates, Polls & Rating");
    expect(raceTitle(txHouse15, "Texas")).toContain("Texas 15th District (TX-15) 2026");
  });
});

describe("raceDescription", () => {
  it("leads with the matchup, rating and poll average", () => {
    expect(raceDescription({ meta: senate, state: tx })).toMatch(
      /^Texas 2026 Senate race: Dana Doe \(D\) vs Ray Roe \(R\), rated Toss-up, poll average D\+2\.5 \(Oct 28\)\./,
    );
  });

  it("falls back to the 2024 presidential margin when there is no poll", () => {
    const noPoll = race({ ...senate, polls: undefined, baseline: { presMargin2024: -13.7 } });
    const d = raceDescription({ meta: noPoll, state: tx });
    expect(d).toContain("2024 presidential margin R+13.7.");
    expect(d.length).toBeLessThanOrEqual(300);
  });
});

describe("raceCardLines", () => {
  it("gives at most three lines, starting with the matchup", () => {
    const lines = raceCardLines({ meta: senate, state: tx });
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines[0]).toBe("Dana Doe (D) vs Ray Roe (R)");
    expect(lines[1]).toBe("Rated Toss-up, poll average D+2.5");
  });
});

describe("raceQa", () => {
  it("lists the candidates and says when the seat is open", () => {
    const who = ask(senate, /Who is running/)?.a ?? "";
    expect(who).toContain("Candidates: Dana Doe (D), Ray Roe (R), Lee Lib (L).");
    expect(who).toContain("seat is open");
    expect(who).toContain("Republican");
  });

  it("says when an incumbent is seeking re-election", () => {
    const withIncumbent = race({ ...senate, candidates: [cand("r", "Ray Roe", "R", true), cand("d", "Dana Doe", "D")] });
    const who = ask(withIncumbent, /Who is running/)?.a ?? "";
    expect(who).toContain("Ray Roe is seeking re-election.");
    expect(who).not.toContain("seat is open");
  });

  it("says plainly when there is no poll average, and names the matchup when there is one", () => {
    const noPoll: RaceMeta = { ...senate, polls: undefined };
    expect(ask(noPoll, /Who is favored/)?.a).toContain("no public poll average");
    expect(ask(senate, /Who is favored/)?.a).toContain("The matchup is Dana Doe (D) vs Ray Roe (R).");
  });

  it("reports fundraising only when the race has receipts", () => {
    const withMoney = race({
      ...senate,
      money: { receipts: { d: 1000000, r: 500000 }, cashOnHand: { d: 250000, r: 100000 }, asOf: "2026-10-22" },
    });
    const money = ask(withMoney, /How much money/)?.a ?? "";
    expect(money).toContain("$1M");
    expect(money).toContain("Oct 22");
    expect(ask(senate, /How much money/)).toBeUndefined();
  });

  it("adds a runoff question only where a majority is required", () => {
    expect(ask({ ...senate, runoffRule: "majority" }, /Is there a runoff/)?.a).toContain("requires a majority winner");
    expect(ask(senate, /Is there a runoff/)).toBeUndefined();
  });

  it("names the 2024 winner from the margin, says so for an exact tie, and drops the question for no data", () => {
    const won = (margin: number | undefined) =>
      ask(race({ ...senate, baseline: { presMargin2024: margin } }), /Did Donald Trump or Kamala Harris win/);
    expect(won(-13.7)?.a).toContain("Donald Trump (R) carried Texas by 13.7 points (R+13.7) in 2024.");
    expect(won(3)?.a).toContain("Kamala Harris (D) carried Texas by 3.0 points (D+3.0) in 2024.");
    expect(won(0)?.a).toContain("Neither carried it");
    expect(won(undefined)).toBeUndefined();
  });

  it("uses at-large wording for Alaska's single House seat", () => {
    const alaska = race({ id: "house:AK-AL", office: "house", state: "AK", district: "AL", name: "Alaska At-Large", baseline: { presMargin2024: -14 } });
    expect(ask(alaska, /Did Donald Trump or Kamala Harris win/, ak)?.q).toContain("Alaska's at-large district");
  });

  it("answers special rules from the notes for statewide races, but not for House races", () => {
    const noted = { ...senate, notes: "Ballots must arrive by Election Day." };
    expect(ask(noted, /Are there special rules/)?.a).toBe("Ballots must arrive by Election Day.");
    const houseNoted = race({ id: "house:TX-02", office: "house", district: "02", name: "Texas 2nd District", notes: "Prior House margin: R+3." });
    expect(ask(houseNoted, /Are there special rules/)).toBeUndefined();
  });
});

describe("relatedRaces", () => {
  const georgia = race({ id: "senate:GA", office: "senate", state: "GA", ratings: { consensus: "tossup" } });
  const floridaSeat = race({ id: "senate:FL", office: "senate", state: "FL", ratings: { consensus: "lean-r" } });
  const txHouse1 = race({ id: "house:TX-01", office: "house", district: "01", name: "Texas 1st District", ratings: { consensus: "solid-r" } });
  const all = [senate, georgia, floridaSeat, txHouse1, txHouse15];
  const names: Record<string, string> = { TX: "Texas", GA: "Georgia", FL: "Florida" };
  const groups = relatedRaces(senate, all, (abbr) => names[abbr] ?? abbr);

  it("never links the race to itself, and no group is empty", () => {
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.races.length, g.title).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.races.map((r) => r.slug))).not.toContain("senate-tx");
  });

  it("groups same-rated races from other states under the office and rating", () => {
    const peers = groups.find((g) => g.title === "Other Senate races rated Toss-up");
    expect(peers?.races.map((r) => r.slug)).toEqual(["senate-ga"]);
  });

  it("links the competitive House seats in the same state", () => {
    const local = groups.find((g) => g.title === "More Texas races");
    expect(local?.races.map((r) => r.slug)).toContain("house-tx-15");
  });
});

describe("every race page", () => {
  it("builds clean, in-limit text with a full question block for all 506 races", () => {
    const races = loadRaces();
    for (const slug of racePageSlugs()) {
      const input = raceContentInput(slug)!;
      const { meta, state } = input;
      const title = raceTitle(meta, state.name);
      const description = raceDescription(input);
      const card = raceCardLines(input);
      const qa = raceQa(input);
      const text = [title, description, ...card, ...qa.flatMap((x) => [x.q, x.a])].join("\n");

      expect(text, slug).not.toMatch(/undefined|NaN|null|\[object/);
      expect(qa.length, slug).toBeGreaterThanOrEqual(5);
      expect(new Set(qa.map((x) => x.q)).size, slug).toBe(qa.length);
      expect(description.length, slug).toBeLessThanOrEqual(300);
      expect(title.length, slug).toBeLessThanOrEqual(75);
      expect(card.length, slug).toBeLessThanOrEqual(3);

      const groups = relatedRaces(meta, races, (abbr) => getState(abbr)!.name);
      expect(groups.flatMap((g) => g.races.map((r) => r.slug)), slug).not.toContain(slug);
    }
  });
});
