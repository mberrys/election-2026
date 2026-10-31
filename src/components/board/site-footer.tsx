import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-10">
      <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 py-6 text-xs text-muted-foreground flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <p>
          Big Board is an independent, free-data tracker. Vote counts come from official state and county election offices;
          projections are our own model, not race calls by AP or any network.
        </p>
        <div className="flex gap-4 shrink-0">
          <Link href="/methodology" className="hover:text-foreground">
            Methodology
          </Link>
          <Link href="/sources" className="hover:text-foreground">
            Sources &amp; licenses
          </Link>
          <a href="https://github.com" className="hover:text-foreground" rel="noreferrer">
            Source code
          </a>
        </div>
      </div>
    </footer>
  );
}
