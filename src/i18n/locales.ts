/**
 * Languages the site is translated into. English is the source language and the only one every page exists in; the
 * other eight have real translated versions of the international guides (`/{lang}/world`, `/{lang}/world/{country}`).
 * Pure data, so the client-side language menu and the proxy can import it without pulling in any message catalog.
 */
export interface Locale {
  /** URL segment and catalog file name: "es" -> `/es/world`, `messages/es.json`. */
  code: string;
  /** The language's own name, as shown in the language menu. */
  native: string;
  english: string;
  /** BCP 47 tag for hreflang, `lang` attributes and date/number formatting. */
  tag: string;
  dir: "ltr" | "rtl";
}

export const LOCALES = [
  { code: "en", native: "English", english: "English", tag: "en", dir: "ltr" },
  { code: "es", native: "Español", english: "Spanish", tag: "es", dir: "ltr" },
  { code: "fr", native: "Français", english: "French", tag: "fr", dir: "ltr" },
  { code: "de", native: "Deutsch", english: "German", tag: "de", dir: "ltr" },
  { code: "pt", native: "Português", english: "Portuguese", tag: "pt", dir: "ltr" },
  { code: "it", native: "Italiano", english: "Italian", tag: "it", dir: "ltr" },
  { code: "ja", native: "日本語", english: "Japanese", tag: "ja", dir: "ltr" },
  { code: "ko", native: "한국어", english: "Korean", tag: "ko", dir: "ltr" },
  { code: "zh", native: "中文", english: "Chinese (Simplified)", tag: "zh-Hans", dir: "ltr" },
] as const satisfies readonly Locale[];

export type LangCode = (typeof LOCALES)[number]["code"];
export type TranslatedLang = Exclude<LangCode, "en">;

export const DEFAULT_LANG: LangCode = "en";

/** The eight languages that have their own URLs (`/{code}/world...`). */
export const TRANSLATED_LANGS: readonly TranslatedLang[] = LOCALES.filter((l) => l.code !== DEFAULT_LANG).map((l) => l.code as TranslatedLang);

export function isLang(code: string): code is LangCode {
  return LOCALES.some((l) => l.code === code);
}

/** True for the eight URL languages. `en` is false: English lives at the unprefixed paths. */
export function isTranslatedLang(code: string): code is TranslatedLang {
  return (TRANSLATED_LANGS as readonly string[]).includes(code);
}

export function getLocale(code: LangCode): (typeof LOCALES)[number] {
  return LOCALES.find((l) => l.code === code)!;
}

/**
 * Path of an international guide in a language: `/world/uk` for English, `/es/world/uk` for Spanish. `rest` is
 * everything after `/world` ("" for the hub, "/uk" for a country).
 */
export function worldPath(lang: LangCode, rest = ""): string {
  return `${lang === DEFAULT_LANG ? "" : `/${lang}`}/world${rest}`;
}
