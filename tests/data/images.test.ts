import { describe, expect, it } from "vitest";
import {
  authorOf,
  hasWatermark,
  licenseFromKey,
  htmlToText,
  isAllowedLicense,
  isConfidentArticle,
  looksDeceased,
  commonsTitle,
  isCommonsOriginal,
  thumbDims,
  titleMatchesName,
  toImageEntry,
  type CommonsInfo,
} from "../../scripts/lib/image-meta";
import { getCandidateImage, getStateImage } from "../../src/data/reference/images";

type Meta = CommonsInfo["extmetadata"];
const meta = (o: Record<string, string>): Meta => Object.fromEntries(Object.entries(o).map(([k, value]) => [k, { value }]));

describe("isAllowedLicense", () => {
  it("accepts public domain, CC0, CC BY and CC BY-SA of any version", () => {
    expect(isAllowedLicense(meta({ LicenseShortName: "Public domain", License: "pd" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "Public domain", License: "pd-usgov-congress-bio" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "PD-USGov", License: "pd-usgov" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC0", License: "cc0" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY 2.0", License: "cc-by-2.0" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY 4.0", License: "cc-by-4.0" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY-SA 3.0", License: "cc-by-sa-3.0" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY-SA 4.0", License: "cc-by-sa-4.0" }))).toBe(true);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY-SA 3.0", License: "cc-by-sa-3.0-migrated" }))).toBe(true);
  });

  it("rejects non-commercial, no-derivatives, GFDL-only, fair use and unknown terms", () => {
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY-NC 4.0", License: "cc-by-nc-4.0" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY-ND 2.0", License: "cc-by-nd-2.0" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY-NC-SA 3.0", License: "cc-by-nc-sa-3.0" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "GFDL", License: "gfdl" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "Fair use", License: "fair use" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "Copyrighted free use", License: "" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "All rights reserved" }))).toBe(false);
    expect(isAllowedLicense(meta({}))).toBe(false);
  });

  it("rejects files flagged non-free even with a free-looking name, and conflicting fields", () => {
    expect(isAllowedLicense(meta({ LicenseShortName: "Public domain", License: "pd", NonFree: "true" }))).toBe(false);
    expect(isAllowedLicense(meta({ LicenseShortName: "CC BY 4.0", License: "cc-by-nc-4.0" }))).toBe(false);
  });
});

describe("hasWatermark", () => {
  it("flags watermark categories, descriptions and file names", () => {
    expect(hasWatermark(meta({ Categories: "Portrait photographs|Images with watermarks" }))).toBe(true);
    expect(hasWatermark(meta({ ImageDescription: "Senator Doe (watermarked copy)" }))).toBe(true);
    expect(hasWatermark(meta({}), "File:Doe watermark.jpg")).toBe(true);
  });

  it("passes clean files", () => {
    expect(hasWatermark(meta({ Categories: "Official portraits|PD US Congress", ImageDescription: "Official portrait" }), "File:Doe.jpg")).toBe(false);
  });
});

describe("htmlToText / authorOf", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">Jane &amp; Joe O&#39;Neil</a>')).toBe("Jane & Joe O'Neil");
    expect(htmlToText("Photo by<br />A&nbsp;B <span style='x'>(cropped)</span>")).toBe("Photo by A B (cropped)");
  });

  it("does not let nested fragments reassemble into a tag", () => {
    expect(htmlToText("<scr<b>ipt>alert(1)</scr</b>ipt>")).not.toMatch(/[<>]/);
  });

  it("trims to 120 characters", () => {
    const t = htmlToText("x".repeat(300));
    expect(t.length).toBeLessThanOrEqual(120);
    expect(t.endsWith("…")).toBe(true);
  });

  it("falls back to Unknown", () => {
    expect(authorOf(meta({ Artist: "" }))).toBe("Unknown");
    expect(authorOf(meta({ Artist: "<span></span>" }))).toBe("Unknown");
    expect(authorOf(meta({}))).toBe("Unknown");
    expect(authorOf(meta({ Artist: "Unknown author" }))).toBe("Unknown");
    expect(authorOf(meta({ Artist: '<a href="x">Gage Skidmore</a>' }))).toBe("Gage Skidmore");
  });
});

describe("toImageEntry", () => {
  const good: CommonsInfo = {
    title: "File:John Doe official portrait.jpg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:John_Doe_official_portrait.jpg",
    thumburl:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/John_Doe_official_portrait.jpg/500px-John_Doe_official_portrait.jpg?utm_source=commons.wikimedia.org",
    mime: "image/jpeg",
    width: 2000,
    height: 2500,
    extmetadata: meta({
      LicenseShortName: "CC BY-SA 4.0",
      License: "cc-by-sa-4.0",
      LicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      Artist: '<a href="https://example.org">Jane Roe</a>',
      Categories: "Official portraits",
    }),
  };

  it("builds the stored entry from a good file", () => {
    const r = toImageEntry(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.img).toEqual({
        thumbUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/John_Doe_official_portrait.jpg/500px-John_Doe_official_portrait.jpg",
        width: 500,
        height: 625,
        filePage: good.descriptionurl,
        author: "Jane Roe",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      });
    }
  });

  it("rejects narrow images, SVG and other non-photo types", () => {
    expect(toImageEntry({ ...good, width: 250, height: 300 })).toEqual({ ok: false, reason: "too-small" });
    expect(toImageEntry({ ...good, mime: "image/svg+xml", title: "File:Logo.svg" })).toEqual({ ok: false, reason: "mime" });
    expect(toImageEntry({ ...good, mime: "image/gif" })).toEqual({ ok: false, reason: "mime" });
  });

  it("rejects bad licences and watermarks", () => {
    expect(toImageEntry({ ...good, extmetadata: meta({ LicenseShortName: "CC BY-NC 2.0", License: "cc-by-nc-2.0" }) })).toEqual({ ok: false, reason: "licence" });
    expect(toImageEntry({ ...good, extmetadata: { ...good.extmetadata, Categories: { value: "Images with watermarks" } } })).toEqual({ ok: false, reason: "watermark" });
  });

  it("enforces a landscape range when asked", () => {
    expect(toImageEntry(good, { minAspect: 1.2 })).toEqual({ ok: false, reason: "aspect" });
    expect(toImageEntry({ ...good, width: 4000, height: 1000 }, { maxAspect: 2.8 })).toEqual({ ok: false, reason: "aspect" });
    expect(toImageEntry({ ...good, width: 4000, height: 2500, thumburl: good.thumburl!.replace("500px", "960px") }, { minAspect: 1.2, maxAspect: 2.8 }).ok).toBe(true);
  });

  it("omits licenseUrl when absent and falls back to the original for small files", () => {
    const small: CommonsInfo = {
      ...good,
      width: 400,
      height: 500,
      thumburl: undefined,
      url: "https://upload.wikimedia.org/wikipedia/commons/e/ea/John_Doe_official_portrait.jpg",
      extmetadata: meta({ LicenseShortName: "Public domain", License: "pd" }),
    };
    const r = toImageEntry(small);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.img.licenseUrl).toBeUndefined();
      expect(r.img.author).toBe("Unknown");
      expect(r.img.width).toBe(400);
      expect(r.img.height).toBe(500);
    }
  });
});

describe("thumbDims", () => {
  it("scales the original's aspect ratio to the thumbnail width", () => {
    expect(thumbDims("https://x/y/960px-A.jpg", 4000, 3000)).toEqual({ width: 960, height: 720 });
    expect(thumbDims("https://x/y/A.jpg", 400, 300)).toEqual({ width: 400, height: 300 });
    expect(thumbDims("https://x/y/500px-A.jpg", 300, 300)).toEqual({ width: 300, height: 300 });
  });
});

describe("article matching", () => {
  it("matches titles to names, with nicknames, middle names and disambiguators", () => {
    expect(titleMatchesName("John Fetterman", "John Fetterman")).toBe(true);
    expect(titleMatchesName("Rick Allen (politician)", "Rick Allen")).toBe(true);
    expect(titleMatchesName("Michael Rogers (Michigan politician)", "Mike Rogers")).toBe(true);
    expect(titleMatchesName("Jonathan Kreiss-Tomkins", "Jonathan Kreiss-Tomkins")).toBe(true);
    expect(titleMatchesName("John Karl Fetterman", "John Fetterman")).toBe(true);
    expect(titleMatchesName("Mike Stack", "John Fetterman")).toBe(false);
    expect(titleMatchesName("2022 United States Senate election in Pennsylvania", "John Fetterman")).toBe(false);
    expect(titleMatchesName("Jon Fetterman", "Mike Fetterman")).toBe(false);
    expect(titleMatchesName("Sarah Sanders", "Sarah Huckabee Sanders", ["Sarah Sanders"])).toBe(true);
  });

  const fetterman =
    "John Karl Fetterman (born August 15, 1969) is an American politician serving as the senior United States senator from Pennsylvania. A member of the Democratic Party, he served as mayor of Braddock.";

  it("accepts a confident match and rejects wrong state, wrong party and deceased namesakes", () => {
    const ctx = { name: "John Fetterman", party: "D", stateName: "Pennsylvania" };
    expect(isConfidentArticle("John Fetterman", fetterman, ctx)).toBe(true);
    expect(isConfidentArticle("John Fetterman", fetterman, { ...ctx, stateName: "Ohio" })).toBe(false);
    expect(isConfidentArticle("John Fetterman", fetterman, { ...ctx, party: "R" })).toBe(false);
    const dead = "John Fetterman (March 5, 1920 – April 1, 2000) was an American politician who served in the Pennsylvania House of Representatives. A Republican.";
    expect(isConfidentArticle("John Fetterman", dead, { ...ctx, party: "R" })).toBe(false);
    expect(looksDeceased(dead)).toBe(true);
    expect(looksDeceased(fetterman)).toBe(false);
  });

  it("does not take West Virginia for Virginia or Washington, D.C. for Washington", () => {
    const wv = "Jane Roe (born 1970) is an American politician from West Virginia, a member of the House of Delegates.";
    expect(isConfidentArticle("Jane Roe", wv, { name: "Jane Roe", stateName: "Virginia" })).toBe(false);
    expect(isConfidentArticle("Jane Roe", wv, { name: "Jane Roe", stateName: "West Virginia" })).toBe(true);
    const dc = "Jane Roe (born 1970) is an American politician and lobbyist based in Washington, D.C.";
    expect(isConfidentArticle("Jane Roe", dc, { name: "Jane Roe", stateName: "Washington" })).toBe(false);
  });

  it("only takes Commons-hosted files", () => {
    expect(isCommonsOriginal("https://upload.wikimedia.org/wikipedia/commons/e/ea/A.jpg?utm_source=x")).toBe(true);
    expect(isCommonsOriginal("https://upload.wikimedia.org/wikipedia/en/e/ea/A.jpg")).toBe(false);
    expect(commonsTitle("John_Doe_official_portrait.jpg")).toBe("File:John Doe official portrait.jpg");
  });
});

describe("built images.json", () => {
  it("every stored entry that exists is credited (checked on the real build)", () => {
    const ca = getStateImage("CA");
    if (!ca) return; // not built yet
    expect(ca.license.length).toBeGreaterThan(0);
    expect(ca.author.length).toBeGreaterThan(0);
    expect(ca.author.length).toBeLessThanOrEqual(120);
    expect(ca.filePage).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(ca.thumbUrl).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
    expect(ca.width).toBeGreaterThan(ca.height);
  });

  it("returns undefined for unknown ids", () => {
    expect(getCandidateImage("no-such-candidate")).toBeUndefined();
    expect(getCandidateImage("constructor")).toBeUndefined();
    expect(getStateImage("ZZ")).toBeUndefined();
  });
});

describe("licenseFromKey", () => {
  it("names the licence from Commons' key instead of assuming public domain", () => {
    expect(licenseFromKey("cc-by-sa-4.0")).toBe("CC BY-SA 4.0");
    expect(licenseFromKey("cc-by-2.0")).toBe("CC BY 2.0");
    expect(licenseFromKey("cc0")).toBe("CC0");
    expect(licenseFromKey("pd-usgov")).toBe("Public domain");
    expect(licenseFromKey("")).toBe("");
  });
});
