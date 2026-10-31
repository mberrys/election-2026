import Link from "next/link";
import { LiveStatus } from "./live-status";
import { HeaderBalance } from "./header-balance";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/senate", label: "Senate" },
  { href: "/house", label: "House" },
  { href: "/governors", label: "Governors" },
  { href: "/states", label: "States & Measures" },
  { href: "/methodology", label: "Method" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 md:px-6 h-14">
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="display text-2xl font-800 leading-none tracking-tight">BIG BOARD</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Midterms 2026</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <HeaderBalance />
          </div>
          <LiveStatus />
        </div>
      </div>
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2 text-sm scrollbar-thin">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
