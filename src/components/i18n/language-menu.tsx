"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { DEFAULT_LANG, LOCALES, TRANSLATED_LANGS, worldPath, type LangCode } from "@/i18n/locales";

export interface MenuLabels {
  /** "Language": the button's accessible name, followed by the current language. */
  label: string;
  /** "Other pages open in Google Translate". */
  note: string;
}

const WORLD = new RegExp(`^(?:/(${TRANSLATED_LANGS.join("|")}))?/world((?:/[^/]+)?)/?$`);

/** Where the page is and what language it is in: a /world page (any language) or a page with no translated version. */
export function whereAmI(pathname: string): { lang: LangCode; world: boolean; rest: string } {
  const m = WORLD.exec(pathname);
  if (!m) return { lang: DEFAULT_LANG, world: false, rest: "" };
  return { lang: (m[1] as LangCode | undefined) ?? DEFAULT_LANG, world: true, rest: m[2] ?? "" };
}

/** Google Translate's address for a page: `sl` is the page's language, `tl` the target, `u` the absolute page URL. */
export function translateUrl(code: LangCode, pageUrl: string): string {
  const tl = code === "zh" ? "zh-CN" : code;
  return `https://translate.google.com/translate?sl=en&tl=${tl}&u=${encodeURIComponent(pageUrl)}`;
}

const itemClass =
  "flex h-11 w-full cursor-pointer items-center justify-center rounded-md no-underline outline-none select-none data-[highlighted]:bg-s3 focus-visible:ring-[3px] focus-visible:ring-signal focus-visible:ring-inset";

/** A small flag standing in for the language's name; the name stays as the accessible label and the tooltip. */
function Flag({ flag, current }: { flag: string; current?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/flags/${flag}.svg`} alt="" width={24} height={18} className={`h-[18px] w-6 rounded-[3px] object-cover ${current ? "ring-2 ring-signal" : "ring-1 ring-border"}`} />
  );
}

/**
 * Language button for the site header. On the international guides each language is a link to the same page in that
 * language; everywhere else there is no translated page, so each language opens the current page in Google Translate
 * in a new tab. Labels arrive as props (all nine languages' worth, a few words each) and `siteUrl` from the server,
 * because the production origin is not available to client code.
 */
export function LanguageMenu({ labels, siteUrl }: { labels: Record<string, MenuLabels>; siteUrl: string }) {
  const pathname = usePathname();
  const noteId = useId();
  const { lang, world, rest } = whereAmI(pathname);
  const here = LOCALES.find((l) => l.code === lang)!;
  const ui = labels[lang] ?? labels[DEFAULT_LANG];

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={`${ui.label}: ${here.native}`}
        title={here.native}
        className="inline-flex size-11 items-center justify-center rounded-md opacity-80 transition-opacity outline-none hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-signal data-[popup-open]:opacity-100"
      >
        <Flag flag={here.flag} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-50 outline-none">
          <Menu.Popup
            aria-describedby={world ? undefined : noteId}
            aria-label={ui.label}
            className="w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground elev-3 outline-none"
          >
            <div className="grid grid-cols-3 gap-0.5">
            {LOCALES.map((l) => {
              const current = l.code === lang;
              const label = <Flag flag={l.flag} current={current} />;
              // the flag replaces the name on screen; the name is still the accessible label and the tooltip
              const named = { "aria-label": l.native, title: l.native, lang: l.tag };
              if (world) {
                return (
                  <Menu.LinkItem
                    key={l.code}
                    render={<Link href={worldPath(l.code, rest)} hrefLang={l.tag} />}
                    aria-current={current ? "page" : undefined}
                    className={itemClass}
                    {...named}
                  >
                    {label}
                  </Menu.LinkItem>
                );
              }
              // No translated version of this page: English stays here, everything else goes through Google Translate.
              if (l.code === DEFAULT_LANG) {
                return (
                  <Menu.LinkItem key={l.code} render={<Link href={pathname} />} aria-current="page" className={itemClass}
                    {...named}>
                    {label}
                  </Menu.LinkItem>
                );
              }
              return (
                <Menu.LinkItem
                  key={l.code}
                  href={translateUrl(l.code, `${siteUrl}${pathname === "/" ? "" : pathname}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  hrefLang={l.tag}
                  className={itemClass}
                    {...named}
                >
                  {label}
                </Menu.LinkItem>
              );
            })}
            </div>
            {!world && (
              <p id={noteId} className="mt-1 border-t border-border px-3 pt-3 pb-2 text-sm text-muted-foreground">
                {ui.note}
              </p>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
