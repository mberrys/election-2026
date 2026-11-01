import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "cn";

/** Shared look for inline text links on the ballot page. */
export const textLink = "font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground";

/** Opens in a new tab; says so to screen readers. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className ?? textLink}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A list of tappable rows in one bordered surface. */
export function RowList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul aria-label={label} className={cn("divide-y divide-border overflow-hidden rounded-lg border border-border bg-card", className)}>
      {children}
    </ul>
  );
}

/** One large row: title (18px, semibold) and an optional one-line description. External rows open in a new tab. */
export function LinkRow({ href, title, desc, external = false }: { href: string; title: ReactNode; desc?: ReactNode; external?: boolean }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-semibold leading-snug text-foreground">{title}</span>
        {desc ? <span className="mt-1 block text-[15px] leading-normal text-ink-muted">{desc}</span> : null}
      </span>
      {external ? (
        <ArrowUpRight aria-hidden className="size-5 shrink-0 text-ink-muted transition-colors group-hover:text-foreground" />
      ) : (
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted transition-colors group-hover:text-foreground" />
      )}
    </>
  );
  const cls = "group flex min-h-16 items-center gap-4 px-5 py-4 transition-colors hover:bg-s3 focus-visible:bg-s3";
  return (
    <li>
      {external ? (
        <ExternalLink href={href} className={cls}>
          {body}
        </ExternalLink>
      ) : (
        <Link href={href} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** A calm, specific message: bold title, muted body. */
export function Notice({ title, children, role = "status" }: { title: string; children?: ReactNode; role?: "status" | "alert" }) {
  return (
    <div role={role} className="rounded-lg border border-border bg-card px-5 py-4">
      <p className="text-[18px] font-semibold leading-snug text-foreground">{title}</p>
      {children ? <div className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{children}</div> : null}
    </div>
  );
}

/** Group heading above a list: display face, bold, with an optional muted note. */
export function GroupHeading({ id, children, note }: { id?: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 id={id} className="display text-[18px] font-bold leading-snug text-foreground">
        {children}
      </h3>
      {note ? <p className="text-[13px] text-ink-muted">{note}</p> : null}
    </div>
  );
}
