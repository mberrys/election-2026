"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Header link; the current section is ink with a chartreuse bar along the header's bottom edge (and aria-current). */
export function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full items-center whitespace-nowrap rounded-sm px-3 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-sm after:bg-signal after:opacity-0 after:transition-opacity hover:after:opacity-30",
        active && "font-semibold text-foreground after:opacity-100 hover:after:opacity-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}
