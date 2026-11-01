import type { Party, RaceStatus, RatingCode, Tier } from "@/data/schema";
import { ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BBStamp, CheckMark } from "./hatch";

const chip = "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[3px] px-1.5 text-xs font-semibold leading-none";

type Main = "D" | "R" | "I";
const main = (p?: Party): Main | undefined => (p === "D" || p === "R" ? p : p ? "I" : undefined);

/**
 * Race state in the Hatch grammar:
 *   projected  → solid party fill + BB stamp, "Projected · Big Board"
 *   certified  → solid party fill + ink check (decided)
 *   counting   → dashed party outline on a tint when someone leads, else a neutral outline
 *   not started→ nothing (no mark carries information before the first vote)
 */
export function StatusBadge({
  status,
  party,
  leader,
  className,
}: {
  status: RaceStatus;
  party?: Party;
  /** Current vote leader's party while counting; draws the "leading" style. */
  leader?: Party;
  className?: string;
}) {
  const p = main(party);
  if (status === "projected")
    return (
      <span className={cn(chip, "border border-hairline bg-s3 pl-1 text-foreground", className)}>
        <BBStamp party={p} />
        Projected · Big Board
      </span>
    );
  if (status === "certified")
    return (
      <span
        className={cn(
          chip,
          p === "D" ? "bg-party-d text-on-party" : p === "R" ? "bg-party-r text-on-party" : p ? "bg-party-i text-ground" : "bg-ink text-ground",
          className,
        )}
      >
        <CheckMark />
        Certified
      </span>
    );
  if (status === "runoff") return <span className={cn(chip, "border border-border-strong text-foreground", className)}>Runoff</span>;
  if (status === "counting") {
    const l = main(leader);
    if (l)
      return (
        <span
          className={cn(
            chip,
            l === "D" ? "lead-d text-party-d-ink" : l === "R" ? "lead-r text-party-r-ink" : "lead-i text-party-i",
            className,
          )}
        >
          {leader} leads
        </span>
      );
    return <span className={cn(chip, "border border-border-strong text-muted-foreground", className)}>Counting</span>;
  }
  // Nothing counted yet: no mark. Pages say when polls close instead.
  return null;
}

/** Consensus rating: a forecast, not a count. One mark only: the label in the favoured party's ink, toss-ups in plain ink. */
export function RatingBadge({ rating, className }: { rating?: RatingCode; className?: string }) {
  if (!rating) return null;
  const lean = rating.endsWith("-d") ? "d" : rating.endsWith("-r") ? "r" : null;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap text-sm font-semibold",
        lean === "d" ? "text-party-d-ink" : lean === "r" ? "text-party-r-ink" : "text-foreground",
        className,
      )}
    >
      {ratingLabel[rating]}
    </span>
  );
}

/** Source tier: A = solid ink square, B = outlined square, C = dashed faint outline. */
export function TierBadge({ tier, className }: { tier?: Tier; className?: string }) {
  if (!tier) return null;
  const label = tier === "A" ? "Official feed" : tier === "B" ? "County feeds" : "Delayed";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground", className)} title={`Tier ${tier}: ${label}`}>
      <span
        aria-hidden
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-[2px] text-[12px] font-extrabold leading-none",
          tier === "A" && "bg-ink text-ground",
          tier === "B" && "border border-ink text-foreground",
          tier === "C" && "border border-dashed border-ink-faint text-ink-faint",
        )}
      >
        {tier}
      </span>
      {label}
    </span>
  );
}

export function PartyDot({ party, className }: { party: Party; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        party === "D" ? "bg-party-d" : party === "R" ? "bg-party-r" : party === "O" ? "bg-party-o" : "bg-party-i",
        className,
      )}
    />
  );
}
