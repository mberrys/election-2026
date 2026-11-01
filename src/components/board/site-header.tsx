import Link from "next/link";
import { NavLink } from "./nav-link";
import { FreshnessRail, LiveStatus } from "./live-status";
import { HeaderBalance } from "./header-balance";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/senate", label: "Senate" },
  { href: "/house", label: "House" },
  { href: "/governors", label: "Governors" },
  { href: "/states", label: "States & Measures" },
  { href: "/history", label: "Then & Now" },
  { href: "/ballot", label: "My Ballot" },
  { href: "/methodology", label: "Method" },
] as const;

export function SiteHeader() {
  return (
    <header className="z-40 border-b border-border bg-background lg:sticky lg:top-0">
      <FreshnessRail />
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-5 px-4 md:px-6">
        <Link href="/" className="shrink-0" aria-label="Big Board, 2026 midterms">
          <span className="text-[22px] font-extrabold leading-none tracking-tight" style={{ fontStretch: "125%" }}>
            BIG BOARD
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-[15px] lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden xl:block">
            <HeaderBalance />
          </div>
          <LiveStatus />
        </div>
      </div>
      <nav className="flex flex-wrap gap-x-1 px-2 pb-1.5 text-[15px] md:px-4 lg:hidden">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
