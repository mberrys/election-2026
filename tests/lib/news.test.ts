import { describe, expect, it } from "vitest";
import { getRace, getState } from "../../src/data/reference/load";
import {
  ballotDesignator,
  dedupeItems,
  fetchRaceNews,
  filterByMustMatch,
  mainNominees,
  newsQueryFor,
  parseGdelt,
  parseGoogleNewsRss,
  refineItems,
  surnameOf,
  titleHasTerm,
  type NewsItem,
} from "../../src/lib/news";

const race = (id: string) => {
  const r = getRace(id);
  if (!r) throw new Error(`missing race ${id}`);
  return r;
};
const stateName = (id: string) => getState(race(id).state)?.name ?? "";

const item = (title: string, publishedAt: string, url = `https://example.test/${encodeURIComponent(title)}`): NewsItem => ({
  title,
  url,
  outlet: "Example",
  publishedAt,
});

describe("newsQueryFor", () => {
  it("builds a Senate query from the D and R nominees, incumbent first", () => {
    const { query, mustMatch } = newsQueryFor(race("senate:GA"), stateName("senate:GA"));
    expect(query).toBe('("Jon Ossoff" OR "Mike Collins") "Georgia" Senate');
    expect(mustMatch).toEqual(expect.arrayContaining(["Jon Ossoff", "Ossoff", "Mike Collins", "Collins"]));
  });

  it("skips minor-party candidates in a governor race", () => {
    const { query } = newsQueryFor(race("governor:AZ"), stateName("governor:AZ"));
    expect(query).toBe('("Katie Hobbs" OR "Andy Biggs") "Arizona" governor');
    expect(query).not.toContain("Lombardo");
    expect(query).not.toContain("Hourihan");
  });

  it("builds a House query with nominees, district and state; keeps compound surnames whole", () => {
    const { query, mustMatch } = newsQueryFor(race("house:TX-15"), stateName("house:TX-15"));
    expect(query).toBe('("Monica De La Cruz" OR "Bobby Pulido") ("Texas" OR "TX-15" OR "15th District")');
    expect(mustMatch).toContain("De La Cruz");
    expect(mustMatch).not.toContain("Cruz");
  });

  it("uses the measure's number and state for a numbered ballot measure", () => {
    const { query, mustMatch } = newsQueryFor(race("ballot:CA-prop-3"), stateName("ballot:CA-prop-3"));
    expect(query).toBe('("Proposition 3" OR "Prop 3") "California"');
    expect(mustMatch).toEqual(["Proposition 3", "Prop 3", "Prop. 3"]);
  });

  it("handles other designators (Amendment 81, Question 4, Issue 3, Proposal 2)", () => {
    expect(newsQueryFor(race("ballot:CO-amendment-81"), "Colorado").query).toBe('"Amendment 81" "Colorado"');
    expect(newsQueryFor(race("ballot:MA-question-4"), "Massachusetts").query).toBe('"Question 4" "Massachusetts"');
    expect(newsQueryFor(race("ballot:OH-issue-3"), "Ohio").mustMatch).toEqual(["Issue 3"]);
    expect(newsQueryFor(race("ballot:MI-proposal-2"), "Michigan").mustMatch).toEqual(["Proposal 2"]);
  });

  it("falls back to key title words for an unnumbered measure", () => {
    const { query, mustMatch } = newsQueryFor(race("ballot:GA-require-nonpartisan-elections-for-probate"), "Georgia");
    expect(query).toContain('"Georgia"');
    expect(query).toContain("nonpartisan");
    expect(query).toContain("probate");
    expect(query).not.toContain("Require");
    expect(mustMatch.length).toBeGreaterThanOrEqual(2);
    expect(mustMatch).toContain("nonpartisan");
  });
});

describe("name and measure helpers", () => {
  it("extracts surnames", () => {
    expect(surnameOf("Jon Ossoff")).toBe("Ossoff");
    expect(surnameOf("Monica De La Cruz")).toBe("De La Cruz");
    expect(surnameOf("Robert Smith Jr.")).toBe("Smith");
    expect(surnameOf("Cher")).toBe("");
  });

  it("picks main nominees, incumbent first, minor parties only when incumbent", () => {
    const names = mainNominees(race("governor:AZ").candidates).map((c) => c.name);
    expect(names).toEqual(["Katie Hobbs", "Andy Biggs"]);
  });

  it("finds ballot designators", () => {
    expect(ballotDesignator("Proposition 3: California Renew State Income Tax")?.label).toBe("Proposition 3");
    expect(ballotDesignator("Montana CI-132, Require Nonpartisan Judicial Elections Initiative")?.label).toBe("CI-132");
    expect(ballotDesignator("South Dakota Constitutional Amendment J, Citizenship")?.label).toBe("Amendment J");
    expect(ballotDesignator("Georgia Increase Acre Limit for Agriculture Amendment")).toBeNull();
  });
});

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>"Jon Ossoff" - Google News</title>
<item>
  <title>Ossoff &amp; Collins trade barbs in Atlanta debate - Atlanta Journal-Constitution</title>
  <link>https://news.google.com/rss/articles/AAA?oc=5</link>
  <pubDate>Fri, 30 Oct 2026 14:05:00 GMT</pubDate>
  <source url="https://www.ajc.com">Atlanta Journal-Constitution</source>
</item>
<item>
  <title><![CDATA[Georgia Senate race: what Jon Ossoff's &#39;ad blitz&#39; means - Politico]]></title>
  <link>https://news.google.com/rss/articles/BBB?oc=5</link>
  <pubDate>Thu, 29 Oct 2026 09:00:00 GMT</pubDate>
  <source url="https://www.politico.com">Politico</source>
</item>
<item>
  <title>No link item</title>
  <pubDate>Thu, 29 Oct 2026 09:00:00 GMT</pubDate>
</item>
<item>
  <title>Bad date - Somewhere</title>
  <link>https://news.google.com/rss/articles/CCC</link>
  <pubDate>not a date</pubDate>
  <source url="https://x.test">Somewhere</source>
</item>
</channel></rss>`;

describe("parseGoogleNewsRss", () => {
  const items = parseGoogleNewsRss(RSS);

  it("returns only complete items", () => {
    expect(items).toHaveLength(2);
  });

  it("strips the outlet suffix and decodes entities", () => {
    expect(items[0]).toEqual({
      title: "Ossoff & Collins trade barbs in Atlanta debate",
      url: "https://news.google.com/rss/articles/AAA?oc=5",
      outlet: "Atlanta Journal-Constitution",
      publishedAt: "2026-10-30T14:05:00.000Z",
    });
    expect(items[1]?.title).toBe("Georgia Senate race: what Jon Ossoff's 'ad blitz' means");
    expect(items[1]?.outlet).toBe("Politico");
  });

  it("tolerates empty or non-RSS input", () => {
    expect(parseGoogleNewsRss("")).toEqual([]);
    expect(parseGoogleNewsRss("<html>blocked</html>")).toEqual([]);
  });
});

describe("parseGdelt", () => {
  it("maps articles, using a known outlet name or the bare domain", () => {
    const out = parseGdelt({
      articles: [
        { url: "https://www.politico.com/a", title: "A &amp; B", seendate: "20261030T140500Z", domain: "politico.com" },
        { url: "https://www.smalltown.example/x", title: "Local piece", seendate: "20261029T090000Z", domain: "smalltown.example" },
        { url: "https://bad.example/", title: "No date", seendate: "" },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ title: "A & B", outlet: "Politico", publishedAt: "2026-10-30T14:05:00.000Z" });
    expect(out[1]?.outlet).toBe("smalltown.example");
    expect(parseGdelt({ articles: [{ url: "https://a.test/", title: "Obama , in Midwest , assails Trump", seendate: "20261025T124500Z" }] })[0]?.title).toBe("Obama, in Midwest, assails Trump");
    expect(parseGdelt({})).toEqual([]);
    expect(parseGdelt(null)).toEqual([]);
  });
});

describe("mustMatch filter", () => {
  const items = [item("Ossoff leads in new poll", "2026-10-30T10:00:00Z"), item("Susan Collins campaigns in Maine", "2026-10-30T09:00:00Z"), item("Prop 30 explained", "2026-10-29T09:00:00Z")];

  it("keeps headlines containing at least one term, case-insensitively", () => {
    expect(filterByMustMatch(items, ["ossoff"]).map((i) => i.title)).toEqual(["Ossoff leads in new poll"]);
  });

  it("matches whole terms only", () => {
    expect(titleHasTerm("Prop 30 explained", "Prop 3")).toBe(false);
    expect(titleHasTerm("What Prop 3 would do", "Prop 3")).toBe(true);
    expect(titleHasTerm("CI 132 vote", "CI-132")).toBe(true);
  });

  it("can require several terms and keeps everything when no terms are given", () => {
    const list = [item("Probate judges go nonpartisan", "2026-10-30T10:00:00Z"), item("Judges on the bench", "2026-10-30T09:00:00Z")];
    expect(filterByMustMatch(list, ["probate", "nonpartisan", "judges"], 2).map((i) => i.title)).toEqual(["Probate judges go nonpartisan"]);
    expect(filterByMustMatch(list, [])).toHaveLength(2);
  });
});

describe("dedupe and refine", () => {
  it("drops near-identical titles, keeping the first (newest)", () => {
    const list = [
      item("Ossoff and Collins clash in final debate", "2026-10-30T12:00:00Z", "https://a.test/1"),
      item("Ossoff and Collins clash in final debate - Updated", "2026-10-30T11:00:00Z", "https://b.test/2"),
      item("Collins pitches economic plan in Macon", "2026-10-30T10:00:00Z", "https://c.test/3"),
      item("Anything", "2026-10-30T09:00:00Z", "https://c.test/3"),
    ];
    expect(dedupeItems(list).map((i) => i.url)).toEqual(["https://a.test/1", "https://c.test/3"]);
  });

  it("filters, sorts newest first and caps at 20", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    const many = Array.from({ length: 30 }, (_, i) => item(`Ossoff story number ${i} about topic${i} unique${i * 7}`, new Date(now - (i + 1) * 3600_000).toISOString()));
    const shuffled = [...many].reverse();
    shuffled.push(item("Unrelated sports headline", new Date(now - 1000).toISOString()));
    const out = refineItems(shuffled, ["Ossoff"], 1, now);
    expect(out).toHaveLength(20);
    expect(out[0]?.title).toContain("number 0 ");
    expect(out.some((i) => i.title.includes("sports"))).toBe(false);
    for (let i = 1; i < out.length; i++) expect(Date.parse(out[i - 1]!.publishedAt)).toBeGreaterThan(Date.parse(out[i]!.publishedAt));
  });
});

describe("fetchRaceNews", () => {
  const ga = () => race("senate:GA");
  const now = Date.parse("2026-10-31T12:00:00Z");

  it("falls back to Google News when GDELT answers 429, and filters off-topic results", async () => {
    const calls: string[] = [];
    const fakeFetch = (async (input: URL | string) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("gdeltproject.org")) return new Response("Please limit requests", { status: 429 });
      return new Response(RSS.replace("Georgia Senate race:", "Georgia Senate race:"), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await fetchRaceNews(ga(), "Georgia", { fetch: fakeFetch, now });
    expect(out.source).toBe("google-news");
    expect(out.raceId).toBe("senate:GA");
    expect(out.items.map((i) => i.outlet)).toEqual(["Atlanta Journal-Constitution", "Politico"]);
    expect(calls.some((u) => u.includes("news.google.com/rss/search"))).toBe(true);
  });

  it("returns source none and no items when every source fails, without throwing", async () => {
    const boom = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const out = await fetchRaceNews(race("senate:GA"), "Georgia", { fetch: boom, now: now + 10 * 60_000 });
    expect(out.source).toBe("none");
    expect(out.items).toEqual([]);
    expect(out.query).toContain("Ossoff");
  });
});
