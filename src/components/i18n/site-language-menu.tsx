import { getMessages } from "@/i18n";
import { LOCALES } from "@/i18n/locales";
import { SITE_URL } from "@/lib/site";
import { LanguageMenu, type MenuLabels } from "./language-menu";

/**
 * The header's language menu. A server component so the client menu receives just the few words it needs in each
 * language (not the catalogs) and the real site origin for Google Translate links, which client code cannot see.
 */
export function SiteLanguageMenu() {
  const labels: Record<string, MenuLabels> = Object.fromEntries(
    LOCALES.map((l) => {
      const m = getMessages(l.code);
      return [l.code, { label: m["menu.label"], note: m["menu.translate_note"] }];
    }),
  );
  return <LanguageMenu labels={labels} siteUrl={SITE_URL} />;
}
