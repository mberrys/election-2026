"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Plain header link; the current section is ink with a 2px underline (and aria-current for assistive tech). */
export function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "px-2 py-1.5 text-muted-foreground underline-offset-[6px] decoration-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        active && "font-semibold text-foreground underline decoration-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
