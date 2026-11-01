import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { loadRaces } from "../../src/data/reference/load";
import { pageMetadata } from "../../src/lib/page-meta";
import { SITE_PAGES, breadcrumbJsonLd, historyDatasetJsonLd, serializeJsonLd, webPageJsonLd, websiteJsonLd } from "../../src/lib/seo";
import { absoluteUrl, siteUrl } from "../../src/lib/site";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl / absoluteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, trims trailing slashes", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.com//", VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app" })).toBe("https://example.com");
  });

  it("falls back to the Vercel production domain, then localhost", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app" })).toBe("https://prod.vercel.app");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: " ", VERCEL_PROJECT_PRODUCTION_URL: "" })).toBe("http://localhost:3000");
  });

  it("joins paths without doubling slashes", () => {
    expect(absoluteUrl("/history", "https://x.test")).toBe("https://x.test/history");
    expect(absoluteUrl("history", "https://x.test")).toBe("https://x.test/history");
    expect(absoluteUrl("/", "https://x.test")).toBe("https://x.test");
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);
  const measures = loadRaces().filter((r) => r.office === "ballot").length;

  it("lists every static page, all 51 state pages, all 506 race pages and every ballot measure page, once each, as absolute URLs", () => {
    expect(urls).toHaveLength(SITE_PAGES.length + 51 + 506 + measures);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((u) => /^https?:\/\//.test(u))).toBe(true);
    expect(urls).toContain(absoluteUrl("/history"));
    expect(urls).toContain(absoluteUrl("/state/TX"));
    expect(urls).toContain(absoluteUrl("/state/DC"));
  });

  it("lists one race page per Senate, governor and House race, and one per ballot measure", () => {
    expect(urls).toContain(absoluteUrl("/race/senate-tx"));
    expect(urls).toContain(absoluteUrl("/race/governor-ga"));
    expect(urls).toContain(absoluteUrl("/race/house-tx-15"));
    expect(urls).toContain(absoluteUrl("/race/ballot-ca-prop-3"));
    expect(urls.filter((u) => u.includes("/race/"))).toHaveLength(506 + measures);
  });

  it("leaves out API routes and the redirect-only /senate/[state]", () => {
    expect(urls.some((u) => u.includes("/api/") || u.includes("/senate/"))).toBe(false);
  });

  it("sets valid priorities", () => {
    for (const e of sitemap()) {
      expect(e.priority).toBeGreaterThan(0);
      expect(e.priority).toBeLessThanOrEqual(1);
    }
  });
});

describe("pageMetadata", () => {
  it("sets canonical, Open Graph and Twitter tags together, with the site name on share titles", () => {
    const m = pageMetadata({ title: "Texas", description: "About Texas", path: "/state/TX" });
    expect(m.title).toBe("Texas");
    expect(m.alternates).toEqual({ canonical: "/state/TX" });
    expect(m.openGraph).toMatchObject({ title: "Texas · Big Board 2026", description: "About Texas", url: "/state/TX", siteName: "Big Board 2026" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "Texas · Big Board 2026", description: "About Texas" });
  });

  it("uses the default title and description for the home page", () => {
    const m = pageMetadata({ path: "/" });
    expect(m).not.toHaveProperty("title");
    expect(m.openGraph).toMatchObject({ title: "Big Board: 2026 Midterms" });
    expect(m.description).toBeTruthy();
  });
});

describe("robots", () => {
  it("allows crawling, blocks /api/, and points at the sitemap in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const r = robots();
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: "/api/" });
    expect(r.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });

  it("allows crawling locally (no VERCEL_ENV)", () => {
    vi.stubEnv("VERCEL_ENV", "");
    expect(robots().rules).toMatchObject({ allow: "/" });
  });

  it("blocks everything on preview deployments", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("structured data", () => {
  it("escapes < so a payload cannot close the script tag", () => {
    const s = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s).name).toBe("</script><script>alert(1)</script>");
  });

  it("describes the site", () => {
    expect(websiteJsonLd("https://x.test")).toMatchObject({ "@type": "WebSite", url: "https://x.test", "@id": "https://x.test/#website" });
  });

  it("describes a page with its refresh date and the place it is about", () => {
    const w = webPageJsonLd(
      { name: "Texas", description: "d", path: "/state/TX", dateModified: "2026-10-31T00:00:00Z", about: { type: "State", name: "Texas" } },
      "https://x.test",
    );
    expect(w).toMatchObject({
      "@type": "WebPage",
      "@id": "https://x.test/state/TX#webpage",
      isPartOf: { "@id": "https://x.test/#website" },
      dateModified: "2026-10-31T00:00:00Z",
      about: { "@type": "State", name: "Texas" },
    });
    expect(webPageJsonLd({ name: "n", description: "d", path: "/" }, "https://x.test")).not.toHaveProperty("about");
  });

  it("builds an ordered breadcrumb with absolute URLs", () => {
    const b = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Texas", path: "/state/TX" }], "https://x.test");
    expect(b.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://x.test" },
      { "@type": "ListItem", position: 2, name: "Texas", item: "https://x.test/state/TX" },
    ]);
  });

  it("describes the history dataset with its time span and no unverified license", () => {
    const d = historyDatasetJsonLd({ firstYear: 1976, lastYear: 2024, dateModified: "2026-10-31T00:00:00Z" }, "https://x.test");
    expect(d).toMatchObject({ "@type": "Dataset", url: "https://x.test/history", temporalCoverage: "1976/2024", dateModified: "2026-10-31T00:00:00Z" });
    expect(d).not.toHaveProperty("license");
  });
});
