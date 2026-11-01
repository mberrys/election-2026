import Link from "next/link";

const LINKS = [
  { href: "/election-night", label: "Poll closing times" },
  { href: "/explainers", label: "Explainers" },
  { href: "/methodology", label: "Methodology" },
  { href: "/sources", label: "Sources & licenses" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-s1">
      <div className="mx-auto grid w-full max-w-[1600px] gap-8 px-4 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:py-16 lg:px-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-[28px] font-extrabold leading-none tracking-tight md:text-[40px]" style={{ fontStretch: "125%" }}>
            BIG BOARD
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            An independent, free-data tracker. Vote counts come from official state and county election offices; projections are our own
            model, not race calls by AP or any network.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap content-end gap-x-6 gap-y-2 text-[15px] md:justify-end">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
              {l.label}
            </Link>
          ))}
          <a href="https://github.com" className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline" rel="noreferrer">
            Source code
          </a>
        </nav>
      </div>
    </footer>
  );
}
