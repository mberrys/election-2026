import { en, type MessageKey, type Messages } from "./messages/en";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import de from "./messages/de.json";
import pt from "./messages/pt.json";
import it from "./messages/it.json";
import ja from "./messages/ja.json";
import ko from "./messages/ko.json";
import zh from "./messages/zh.json";
import { format, type Vars } from "./format";
import { getLocale, type LangCode, type TranslatedLang } from "./locales";

export { en, format, type MessageKey, type Messages, type Vars };

/** Raw translator files. They may be incomplete or contain a blank: `getMessages` fills those from English. */
const TRANSLATIONS: Record<TranslatedLang, Record<string, string>> = { es, fr, de, pt, it, ja, ko, zh };

const cache = new Map<LangCode, Messages>();

/**
 * Every message for a language. A key that is missing from the language's JSON file, blank, or not a string falls back
 * to English, so a half-finished translation never renders an empty label or a raw key.
 */
export function getMessages(lang: LangCode): Messages {
  const hit = cache.get(lang);
  if (hit) return hit;
  const own = lang === "en" ? {} : TRANSLATIONS[lang];
  const merged = { ...en } as Messages;
  for (const key of Object.keys(en) as MessageKey[]) {
    const v = own[key];
    if (typeof v === "string" && v.trim() !== "") merged[key] = v;
  }
  cache.set(lang, merged);
  return merged;
}

/** Looks up a message and fills its placeholders. Whole-sentence templates keep word order in the translator's hands. */
export function t(messages: Messages, key: MessageKey, vars?: Vars): string {
  return format(messages[key], vars);
}

/** A language's messages plus the helpers pages need, so a page passes one value around. */
export interface I18n {
  lang: LangCode;
  /** BCP 47 tag for `lang` attributes, hreflang and Intl formatting. */
  tag: string;
  messages: Messages;
  t: (key: MessageKey, vars?: Vars) => string;
  /** For keys built at run time ("country.spain.name"); returns undefined when the key does not exist. */
  lookup: (key: string, vars?: Vars) => string | undefined;
  /** A number in the language's own conventions ("8,6" in German). */
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
}

const instances = new Map<LangCode, I18n>();

export function i18n(lang: LangCode): I18n {
  const hit = instances.get(lang);
  if (hit) return hit;
  const messages = getMessages(lang);
  const tag = getLocale(lang).tag;
  const made: I18n = {
    lang,
    tag,
    messages,
    t: (key, vars) => t(messages, key, vars),
    lookup: (key, vars) => (key in messages ? format(messages[key as MessageKey], vars) : undefined),
    num: (n, opts) => new Intl.NumberFormat(tag, opts).format(n),
  };
  instances.set(lang, made);
  return made;
}
