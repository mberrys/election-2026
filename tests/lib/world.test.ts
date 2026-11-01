import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry } from "../../src/components/world/countries";
import { catchUp, closingWaves, etToUtc, finalClose, localTime, worldQa } from "../../src/components/world/world-content";
import { isCrawler, usRedirectFor } from "../../src/lib/geo-gate";
import { loadRaces, loadStates } from "../../src/data/reference/load";

describe("etToUtc / localTime", () => {
  it("treats Election Day as Eastern Standard Time (UTC-5)", () => {
    expect(etToUtc("19:00").toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(etToUtc("18:00").toISOString()).toBe("2026-11-03T23:00:00.000Z");
  });

  it("puts closings after midnight ET on Wednesday", () => {
    expect(etToUtc("01:00").toISOString()).toBe("2026-11-04T06:00:00.000Z");
  });

  it("converts to local clocks, daylight time included", () => {
    const seven = etToUtc("19:00");
    expect(localTime(seven, "Europe/London", "en-GB").time).toBe("00:00");
    expect(localTime(seven, "Asia/Kolkata", "en-IN").time).toMatch(/^5:30/);
    expect(localTime(seven, "Australia/Sydney", "en-AU").time).toMatch(/^11:00/); // AEDT, UTC+11
    expect(localTime(seven, "Australia/Sydney", "en-AU").day).toMatch(/Wednesday/);
  });
});

describe("closingWaves", () => {
  const waves = closingWaves(loadStates(), loadRaces());
  it("covers every state once, earliest first", () => {
    expect(waves.flatMap((w) => w.states)).toHaveLength(loadStates().length);
    for (let i = 1; i < waves.length; i++) expect(waves[i].utc.getTime()).toBeGreaterThan(waves[i - 1].utc.getTime());
  });
});

describe("finalClose", () => {
  it("is the last polls of the night, early Wednesday", () => {
    expect(finalClose(loadStates()).getTime()).toBeGreaterThan(closingWaves(loadStates(), loadRaces()).at(-1)!.utc.getTime() - 1);
  });
});

describe("worldQa", () => {
  const races = loadRaces();
  const waves = closingWaves(loadStates(), races);
  const c = catchUp(races, { margin: 8.6, asOf: "2026-10-30" }, { year: 2020, meanGap: 7.4 });

  it("answers the poll-closing question in the country's own clock", () => {
    const uk = worldQa(c, waves, finalClose(loadStates()), getCountry("uk"))[0];
    expect(uk.q).toBe("What time do US polls close in the UK?");
    expect(uk.a).toContain("London time");
  });

  it("counts what is on the ballot from the reference data", () => {
    expect(c.houseSeats).toBe(435);
    expect(c.senateSeats).toBe(races.filter((r) => r.office === "senate").length);
  });
});

describe("countries", () => {
  it("has unique slugs and valid time zones", () => {
    expect(new Set(COUNTRIES.map((x) => x.slug)).size).toBe(COUNTRIES.length);
    for (const x of COUNTRIES) expect(() => new Intl.DateTimeFormat("en", { timeZone: x.zone })).not.toThrow();
  });
});

describe("usRedirectFor", () => {
  const chrome = "Mozilla/5.0 (Windows NT 10.0) Chrome/130";
  it("sends US visitors to the US pages", () => {
    expect(usRedirectFor("/world", "US", chrome)).toBe("/");
    expect(usRedirectFor("/world/uk", "us", chrome)).toBe("/election-night");
  });

  it("serves everyone else, crawlers, share images and other paths", () => {
    expect(usRedirectFor("/world/uk", "GB", chrome)).toBeNull();
    expect(usRedirectFor("/world/uk", null, chrome)).toBeNull();
    expect(usRedirectFor("/world/uk", "US", "Mozilla/5.0 (compatible; Googlebot/2.1)")).toBeNull();
    expect(usRedirectFor("/world/uk/opengraph-image", "US", chrome)).toBeNull();
    expect(usRedirectFor("/worldwide", "US", chrome)).toBeNull();
    expect(isCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isCrawler(chrome)).toBe(false);
  });
});
