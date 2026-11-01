import Link from "next/link";
import { NavLink } from "./nav-link";
import { FreshnessRail, LiveStatus } from "./live-status";
import { HeaderBalance } from "./header-balance";
import { SiteLanguageMenu } from "@/components/i18n/site-language-menu";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/senate", label: "Senate" },
  { href: "/house", label: "House" },
  { href: "/governors", label: "Governors" },
  { href: "/states", label: "States & Measures" },
  { href: "/history", label: "Flashback" },
  { href: "/ballot", label: "My Ballot" },
  { href: "/methodology", label: "Method" },
] as const;

export function SiteHeader() {
  return (
    <header className="z-40 border-b border-border bg-background lg:sticky lg:top-0">
      <FreshnessRail />
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-6 px-4 md:h-[4.5rem] md:px-8 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Big Board, 2026 midterms">
          <span aria-hidden className="grid size-8 place-items-center rounded-[3px] bg-signal text-[13px] font-black leading-none text-ground" style={{ fontStretch: "125%" }}>
            BB
          </span>
          <span className="text-[21px] font-extrabold leading-none tracking-tight sm:text-[24px]" style={{ fontStretch: "125%" }}>
            BIG BOARD
          </span>
        </Link>
        <nav className="hidden h-full items-stretch text-[15px] xl:flex">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden 2xl:block">
            <HeaderBalance />
          </div>
          <SiteLanguageMenu />
          <LiveStatus />
        </div>
      </div>
      <nav className="scrollbar-thin flex h-11 items-stretch overflow-x-auto px-1 text-[15px] after:w-4 after:shrink-0 after:content-[''] md:px-5 lg:px-7 xl:hidden">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
