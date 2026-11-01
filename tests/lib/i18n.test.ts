import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en, format, getMessages, i18n, t, type MessageKey } from "../../src/i18n";
import { placeholders } from "../../src/i18n/format";
import { DEFAULT_LANG, LOCALES, TRANSLATED_LANGS, getLocale, isLang, isTranslatedLang, worldPath } from "../../src/i18n/locales";
import { COUNTRIES } from "../../src/components/world/countries";
import { worldAlternates } from "../../src/components/world/world-data";
import { loadStates } from "../../src/data/reference/load";
import { translateUrl, whereAmI } from "../../src/components/i18n/language-menu";

const dir = path.join(__dirname, "../../src/i18n/messages");
const raw = (lang: string) => JSON.parse(readFileSync(path.join(dir, `${lang}.json`), "utf8")) as Record<string, unknown>;
const links = (s: string) => [...s.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).sort();
const keys = Object.keys(en) as MessageKey[];

describe("locales", () => {
  it("lists English first plus the eight translated languages, each with a unique code and tag", () => {
    expect(LOCALES[0].code).toBe("en");
    expect(TRANSLATED_LANGS).toEqual(["es", "fr", "de", "pt", "it", "ja", "ko", "zh"]);
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(LOCALES.length);
    for (const l of LOCALES) expect(() => new Intl.Locale(l.tag)).not.toThrow();
    expect(isLang("es") && isTranslatedLang("es") && !isTranslatedLang("en") && !isLang("xx")).toBe(true);
    expect(getLocale("ja").native).toBe("日本語");
  });

  it("builds localized paths", () => {
    expect(worldPath("en")).toBe("/world");
    expect(worldPath("en", "/uk")).toBe("/world/uk");
    expect(worldPath("es", "/uk")).toBe("/es/world/uk");
  });
});

describe("format / t", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(format("{a} of {b}", { a: 1, b: "x" })).toBe("1 of x");
    expect(format("{a} of {b}", { a: 1 })).toBe("1 of {b}");
    expect(format("no vars")).toBe("no vars");
    expect(t(getMessages("en"), "crumb.home")).toBe("Home");
    expect(t(getMessages("en"), "your_time.heading", { zone: "UTC" })).toBe("In your time zone (UTC)");
  });
});

describe("catalog", () => {
  it("has the keys the pages build at run time", () => {
    for (const c of COUNTRIES) for (const part of ["name", "short", "in", "city"]) expect(en, `${c.slug} ${part}`).toHaveProperty([`country.${c.slug}.${part}`]);
    for (const s of loadStates()) expect(en, s.abbr).toHaveProperty([`state.${s.abbr}`]);
    for (const c of COUNTRIES.filter((x) => x.also)) expect(en, c.slug).toHaveProperty([`country.${c.slug}.city_also`]);
  });

  it("keeps markup out of strings except [label](href) links", () => {
    for (const k of keys) expect(en[k], k).not.toMatch(/[<>]/);
  });
});

describe("translation files", () => {
  for (const lang of TRANSLATED_LANGS) {
    describe(lang, () => {
      const file = raw(lang);

      it("only has English keys, with string values", () => {
        for (const [k, v] of Object.entries(file)) {
          expect(keys, `unknown key ${k}`).toContain(k);
          expect(typeof v, k).toBe("string");
        }
      });

      it("keeps every {placeholder} and every link target of the English string", () => {
        for (const k of keys) {
          const v = file[k];
          if (typeof v !== "string" || !v.trim()) continue;
          expect(placeholders(v).sort(), `${lang} ${k}`).toEqual(placeholders(en[k]).sort());
          expect(links(v), `${lang} ${k} links`).toEqual(links(en[k]));
        }
      });
    });
  }
});

describe("getMessages fallback", () => {
  it("returns English for English and a complete catalog for every language", () => {
    expect(getMessages("en")).toEqual(en);
    for (const l of LOCALES) expect(Object.keys(getMessages(l.code))).toHaveLength(keys.length);
  });

  it("never returns a blank string, whatever the translation files contain", () => {
    for (const lang of TRANSLATED_LANGS) for (const k of keys) expect(getMessages(lang)[k].trim(), `${lang} ${k}`).not.toBe("");
  });

  it("looks up run-time keys safely", () => {
    const i = i18n("es");
    expect(i.lookup("country.spain.city")).toBeTypeOf("string");
    expect(i.lookup("country.atlantis.city")).toBeUndefined();
    expect(i.tag).toBe("es");
  });
});

describe("hreflang clusters", () => {
  it("lists the same page in every language, English as x-default", () => {
    const hub = worldAlternates();
    expect(hub).toMatchObject({ en: "/world", es: "/es/world", "zh-Hans": "/zh/world", "x-default": "/world" });
    const uk = worldAlternates(COUNTRIES[0]);
    expect(uk).toMatchObject({ "en-GB": "/world/uk", fr: "/fr/world/uk", ko: "/ko/world/uk", "x-default": "/world/uk" });
    expect(Object.keys(uk)).toHaveLength(2 + TRANSLATED_LANGS.length);
  });

  it("has only valid language tags", () => {
    for (const c of COUNTRIES) for (const tag of Object.keys(worldAlternates(c))) if (tag !== "x-default") expect(() => new Intl.Locale(tag), tag).not.toThrow();
  });
});

describe("language menu helpers", () => {
  it("tells which language and page the menu is on", () => {
    expect(whereAmI("/world")).toEqual({ lang: "en", world: true, rest: "" });
    expect(whereAmI("/world/uk")).toEqual({ lang: "en", world: true, rest: "/uk" });
    expect(whereAmI("/es/world")).toEqual({ lang: "es", world: true, rest: "" });
    expect(whereAmI("/ja/world/south-korea")).toEqual({ lang: "ja", world: true, rest: "/south-korea" });
    for (const p of ["/", "/senate", "/race/senate-ga", "/state/PA", "/es", "/xx/world", "/world/uk/extra"]) expect(whereAmI(p).world, p).toBe(false);
  });

  it("builds Google Translate links with the absolute page URL encoded", () => {
    expect(translateUrl("es", "https://example.com/senate")).toBe("https://translate.google.com/translate?sl=en&tl=es&u=https%3A%2F%2Fexample.com%2Fsenate");
    expect(translateUrl("zh", "https://example.com")).toContain("tl=zh-CN");
    expect(DEFAULT_LANG).toBe("en");
  });
});
