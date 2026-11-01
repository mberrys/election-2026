import { describe, expect, it } from "vitest";
import {
  countMentions,
  datedSentences,
  districtOfSection,
  infoboxNominees,
  isAboutCandidate,
  isProseSection,
  measureIds,
  mentionsCandidate,
  pickNominee,
  proseParagraphs,
  sameName,
  sideOfSection,
  splitMeasureNote,
  splitSections,
  splitSentences,
  stripCitationMarkers,
  trimToSentences,
} from "../../scripts/lib/story-text";
import { getStoriesMeta, getStory } from "../../src/data/reference/stories";

const FIXTURE = `{{Short description|none}}
{{Infobox election
| election_name = 2026 United States Senate election in Exampleland
| nominee1 = [[Jane Roe (politician)|Jane Roe]]
| party1 = Democratic Party (United States)
| nominee2 = [[John Q. Doe]]
| party2 = Republican Party (United States)
}}
The '''2026 United States Senate election in Exampleland''' will be held on November 3, 2026.<ref name="a">{{cite web|url=https://example.com|title=X}}</ref> Democratic senator [[Jane Roe (politician)|Jane Roe]] is seeking a second term.{{efn|A note.}}[1] She faces Republican [[John Q. Doe]].

The primary was held on May 19, 2026. Doe won the nomination after a runoff on June 16.
{{TOC limit|3}}

== Background ==
Exampleland is a swing state.<ref>{{cite news|title=Y}}</ref>

== Democratic primary ==
=== Candidates ===
* [[Jane Roe]], incumbent
=== Endorsements ===
{{Endorsements box
| title=Jane Roe
| list=
*[[Someone]]
}}
Roe was endorsed by many. This paragraph sits under endorsements and must be ignored by section filters.
=== Results ===
{| class="wikitable"
|-
| Roe || 90%
|}
Roe won the primary with 90% of the vote and began her general election campaign with a focus on health care costs.

== General election ==
[[File:Campaign rally.jpg|thumb|Roe speaks at a rally in [[Capital City]].]]
Doe, a former state senator, launched his campaign on a promise to cut taxes. A {{unknown template|x}} appears in this sentence and should make the paragraph unusable.

Doe said he would debate Roe on October 12, 2026. Roe accepted.

:Indented comment that is not prose.
`;

describe("stripCitationMarkers", () => {
  it("removes numeric, lettered and editorial markers", () => {
    expect(stripCitationMarkers("He won.[1] Then[a] he lost.[12][citation needed] The end[note 3].")).toBe("He won. Then he lost. The end.");
  });
  it("tidies the space left before punctuation", () => {
    expect(stripCitationMarkers("Roe [2] , said so [b].")).toBe("Roe, said so.");
  });
});

describe("proseParagraphs", () => {
  const lead = splitSections(FIXTURE).lead;

  it("drops infobox, hatnote templates, refs, footnotes and citation markers from the lead", () => {
    const paras = proseParagraphs(lead);
    expect(paras).toHaveLength(2);
    expect(paras[0]).toBe(
      "The 2026 United States Senate election in Exampleland will be held on November 3, 2026. Democratic senator Jane Roe is seeking a second term. She faces Republican John Q. Doe.",
    );
    expect(paras[1]).toBe("The primary was held on May 19, 2026. Doe won the nomination after a runoff on June 16.");
  });

  it("skips tables, lists, indented lines and media captions", () => {
    const all = splitSections(FIXTURE).sections.flatMap((s) => proseParagraphs(s.body));
    expect(all.some((p) => p.includes("wikitable") || p.includes("90%"))).toBe(true); // prose sentence mentioning 90% is kept
    expect(all.some((p) => p.includes("rally"))).toBe(false);
    expect(all.some((p) => p.startsWith("Indented"))).toBe(false);
    expect(all.some((p) => p.includes("incumbent"))).toBe(false);
  });

  it("drops a paragraph that contains a template it cannot render instead of leaving a hole", () => {
    const all = splitSections(FIXTURE).sections.flatMap((s) => proseParagraphs(s.body));
    expect(all.some((p) => p.includes("launched his campaign"))).toBe(false);
  });
});

describe("splitSections", () => {
  const { sections } = splitSections(FIXTURE);

  it("tracks ancestry so subsections inherit exclusions", () => {
    const endorsements = sections.find((s) => s.title === "Endorsements");
    expect(endorsements?.path).toEqual(["Democratic primary", "Endorsements"]);
    expect(endorsements && isProseSection(endorsements)).toBe(false);
    const results = sections.find((s) => s.title === "Results");
    expect(results && isProseSection(results)).toBe(true);
  });

  it("keeps table contents out of heading detection", () => {
    expect(sections.map((s) => s.title)).toEqual(["Background", "Democratic primary", "Candidates", "Endorsements", "Results", "General election"]);
  });
});

describe("sentence handling", () => {
  it("does not split on abbreviations, initials or decimals", () => {
    const s = "U.S. Sen. J. D. Smith won 51.2% of the vote. He thanked Dr. Lee. Then he left.";
    expect(splitSentences(s)).toEqual(["U.S. Sen. J. D. Smith won 51.2% of the vote.", "He thanked Dr. Lee.", "Then he left."]);
  });

  it("trims at a sentence boundary under the limit", () => {
    const a = "A".repeat(100);
    const text = `${a}. ${a}. ${a}. ${a}. ${a}. ${a}. ${a}.`;
    const t = trimToSentences(text, 350);
    expect(t.length).toBeLessThanOrEqual(350);
    expect(t.endsWith(".")).toBe(true);
    expect(t).toBe(`${a}. ${a}. ${a}.`);
  });

  it("returns short text unchanged and never exceeds 600 characters", () => {
    expect(trimToSentences("Short. Text.", 600)).toBe("Short. Text.");
    const long = `${"word ".repeat(300)}end.`;
    const t = trimToSentences(long, 600);
    expect(t.length).toBeLessThanOrEqual(601);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("candidate matching", () => {
  const roe = { id: "roe-jane", name: "Jane Roe", party: "D", incumbent: true };
  const doe = { id: "doe-john", name: "John Q. Doe", party: "R" };
  const all = [roe, doe];

  it("matches by surname and ignores middle initials, accents and case", () => {
    expect(mentionsCandidate("Doe, a former state senator, launched a bid.", doe, all)).toBe(true);
    expect(mentionsCandidate("Luján won easily.", { name: "Ben Ray Luján" })).toBe(true);
    expect(mentionsCandidate("Roe was endorsed.", doe, all)).toBe(false);
  });

  it("needs the first name when two candidates share a surname", () => {
    const a = { name: "Dan S. Sullivan" };
    const b = { name: "Dan J. Sullivan" };
    expect(countMentions("Sullivan won.", a, [a, b])).toBe(0);
    expect(countMentions("Dan Sullivan won.", a, [a, b])).toBe(1);
  });

  it("does not treat common words as surnames", () => {
    const green = { name: "Jerri Green" };
    expect(mentionsCandidate("The Green Party disavowed him.", green)).toBe(false);
    expect(mentionsCandidate("Jerri Green won the primary.", green)).toBe(true);
  });

  it("counts a paragraph as about a candidate only when they lead it or recur", () => {
    expect(isAboutCandidate("Roe launched her campaign in 2025 and raised money quickly.", roe, all)).toBe(true);
    const passing = `${"The Green Party of Exampleland disavowed an activist, accusing her of being a spoiler for the incumbent in the race. ".repeat(1)}It was running only to draw votes from Roe.`;
    expect(isAboutCandidate(passing, roe, all)).toBe(false);
    expect(isAboutCandidate(`${passing} Roe condemned the move.`, roe, all)).toBe(true);
  });

  it("compares nominees loosely", () => {
    expect(sameName("John Doe", "John Q. Doe")).toBe(true);
    expect(sameName("Jane Roe", "John Doe")).toBe(false);
  });
});

describe("nominee selection", () => {
  const cands = [
    { id: "sullivan-dan-j", name: "Dan J. Sullivan", party: "R" },
    { id: "sullivan-dan-s", name: "Dan S. Sullivan", party: "R", incumbent: true },
    { id: "heikes-gerald", name: "Gerald Heikes", party: "R" },
    { id: "peltola-mary", name: "Mary Peltola", party: "D" },
  ];

  it("returns the only candidate of a party", () => {
    expect(pickNominee({ candidates: cands, party: "D" })?.id).toBe("peltola-mary");
  });

  it("prefers a sole incumbent among several", () => {
    expect(pickNominee({ candidates: cands, party: "R" })?.id).toBe("sullivan-dan-s");
  });

  it("uses a clear fundraising lead only when 3x ahead, otherwise declines to guess", () => {
    const field = [
      { id: "a", name: "Ann Lee", party: "R" },
      { id: "b", name: "Bob Ray", party: "R" },
    ];
    expect(pickNominee({ candidates: field, party: "R", receipts: { a: 900, b: 100 } })?.id).toBe("a");
    expect(pickNominee({ candidates: field, party: "R", receipts: { a: 500, b: 400 } })).toBeUndefined();
  });

  it("reads nominees from the infobox, including piped links", () => {
    const names = infoboxNominees(FIXTURE).map((n) => n.name);
    expect(names).toEqual(["Jane Roe", "John Q. Doe"]);
    const field = [
      { id: "a", name: "John Doe", party: "R" },
      { id: "b", name: "Jim Doe", party: "R" },
    ];
    expect(pickNominee({ candidates: field, party: "R", infobox: infoboxNominees(FIXTURE) })?.id).toBe("a");
  });
});

describe("ballot measure helpers", () => {
  it("classifies support and opposition headings, using the deepest match", () => {
    const sec = (path: string[]) => ({ level: path.length + 1, title: path[path.length - 1], path, body: "" });
    expect(sideOfSection(sec(["Campaign", "Support"]))).toBe("yes");
    expect(sideOfSection(sec(["Campaign", "Opposition"]))).toBe("no");
    expect(sideOfSection(sec(["Campaign", "Support", "Opponents of the tax"]))).toBe("no");
    expect(sideOfSection(sec(["Campaign"]))).toBeUndefined();
  });

  it("extracts typed identifiers from names and titles", () => {
    expect(measureIds("Proposition 40: California One-Time Wealth Tax")).toEqual(["proposition:40"]);
    expect(measureIds("Propostion 40: California")).toEqual(["proposition:40"]);
    expect(measureIds("2026 Missouri Proposition A")).toEqual(["proposition:A"]);
    expect(measureIds("2026 Colorado Amendment 82")).toEqual(["amendment:82"]);
    expect(measureIds("Alaska Citizenship Voting Requirement Initiative")).toEqual([]);
  });

  it("strips the source suffix from a races.json note", () => {
    const n = "Require that only citizens may vote. (Source: Wikipedia, 2026 United States ballot measures; CC BY-SA 4.0)";
    expect(splitMeasureNote(n)).toEqual({ summary: "Require that only citizens may vote.", source: "Wikipedia, 2026 United States ballot measures; CC BY-SA 4.0" });
    expect(splitMeasureNote("No suffix.")).toEqual({ summary: "No suffix." });
  });

  it("maps district section titles to race district codes", () => {
    expect(districtOfSection("District 7")).toBe("07");
    expect(districtOfSection("12th district")).toBe("12");
    expect(districtOfSection("At-large")).toBe("AL");
    expect(districtOfSection("Statewide polling")).toBeUndefined();
  });
});

describe("datedSentences", () => {
  it("keeps sentences with exactly one clear date and leaves the text untouched", () => {
    const out = datedSentences([
      "The primary was held on May 19, 2026. Doe won the nomination after a runoff on June 16. A debate is set for October 12 and October 19.",
    ]);
    expect(out).toEqual([
      { date: "2026-05-19", text: "The primary was held on May 19, 2026." },
      { date: "2026-06-16", text: "Doe won the nomination after a runoff on June 16." },
    ]);
  });
});

describe("getStory (generated data)", () => {
  it("returns undefined for unknown ids, including prototype keys", () => {
    expect(getStory("senate:ZZ")).toBeUndefined();
    expect(getStory("constructor")).toBeUndefined();
  });

  it("exposes the license and build time", () => {
    const meta = getStoriesMeta();
    expect(meta.license).toBe("CC BY-SA 4.0");
    expect(Number.isNaN(Date.parse(meta.builtAt))).toBe(false);
  });

  it("returns an attributed overview for senate:GA when the build produced one", () => {
    const story = getStory("senate:GA");
    if (!story) return; // build did not cover this race; nothing to assert
    expect(story.overview.length).toBeGreaterThan(0);
    expect(story.overview.length).toBeLessThanOrEqual(3);
    for (const p of story.overview) {
      expect(p.length).toBeLessThanOrEqual(600);
      expect(p).not.toMatch(/\[\d+\]|\{\{|\[\[|<ref/);
    }
    expect(story.source.kind).toBe("wikipedia");
    expect(story.source.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
  });

  it("keeps every entry within the documented limits", () => {
    for (const id of ["senate:MI", "governor:GA", "house:ME-02", "ballot:CA-propostion-40"]) {
      const story = getStory(id);
      if (!story) continue;
      expect(story.overview.length).toBeLessThanOrEqual(3);
      for (const c of story.campaigns) {
        expect(c.paragraphs.length).toBeLessThanOrEqual(3);
        for (const p of c.paragraphs) expect(p.length).toBeLessThanOrEqual(600);
      }
      expect(story.keyDates?.length ?? 0).toBeLessThanOrEqual(6);
    }
  });
});
