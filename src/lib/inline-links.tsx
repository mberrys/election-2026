import Link from "next/link";
import type { ReactNode } from "react";

/** `[label](href)` inside plain prose strings. Internal paths start with "/", everything else opens in a new tab. */
const LINK = /\[([^\]]+)\]\((\/(?!\/)[^\s)]*|(?:https?:)?\/\/[^\s)]+)\)/g;

const linkClass = "font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

export function renderInline(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const [whole, label, href] = m;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      href.startsWith("/") && !href.startsWith("//") ? (
        <Link key={m.index} href={href} className={linkClass}>
          {label}
        </Link>
      ) : (
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {label}
        </a>
      ),
    );
    last = m.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}

/** The same text with link markup removed, for meta descriptions and structured data. */
export function stripInline(text: string): string {
  return text.replace(LINK, "$1");
}
