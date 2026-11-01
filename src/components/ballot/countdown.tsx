"use client";

import Link from "next/link";
import { useNow } from "@/hooks/use-now";
import { countdownText } from "./ballot-races";
import { textLink } from "./link-row";

/**
 * The lead sentence of the Election Day block. Renders nothing on the server and during hydration (useNow is null
 * there), so the prerendered page carries only the static text around it and never mismatches.
 */
export function Countdown() {
  const now = useNow();
  if (now === null) return null;
  const text = countdownText(now, new Date(2026, 10, 3).getTime(), new Date(2026, 10, 4).getTime());
  if (text === "past")
    return (
      <>
        <strong className="font-semibold text-foreground">Election Day has passed.</strong>{" "}
        <Link href="/" className={textLink}>
          Follow the count on the Board
        </Link>
        .{" "}
      </>
    );
  return <strong className="font-semibold text-foreground">{text === "today" ? "Today is Election Day." : text} </strong>;
}
