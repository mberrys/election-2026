import { Badge } from "@/components/ui/badge";
import type { Party, RaceStatus, RatingCode, Tier } from "@/data/schema";
import { ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, party, className }: { status: RaceStatus; party?: Party; className?: string }) {
  if (status === "projected")
    return (
      <Badge
        className={cn(
          "border-0 text-white",
          party === "D" ? "bg-party-d" : party === "R" ? "bg-party-r" : "bg-party-i",
          className,
        )}
      >
        Projected
      </Badge>
    );
  if (status === "runoff") return <Badge variant="outline" className={cn("border-stale text-stale", className)}>Runoff</Badge>;
  if (status === "certified") return <Badge variant="secondary" className={className}>Certified</Badge>;
  if (status === "counting") return <Badge variant="outline" className={cn("text-muted-foreground", className)}>Counting</Badge>;
  return <Badge variant="outline" className={cn("text-muted-foreground/70 border-dashed", className)}>Polls open</Badge>;
}

export function RatingBadge({ rating, className }: { rating?: RatingCode; className?: string }) {
  if (!rating) return null;
  const lean = rating.endsWith("-d") ? "D" : rating.endsWith("-r") ? "R" : "T";
  const strength = rating.startsWith("solid") ? 3 : rating.startsWith("likely") ? 2 : 1;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tnum",
        lean === "T" && "bg-uncalled/50 text-foreground",
        lean === "D" && (strength === 3 ? "bg-party-d text-white" : strength === 2 ? "bg-party-d-soft" : "bg-party-d-faint text-party-d-ink"),
        lean === "R" && (strength === 3 ? "bg-party-r text-white" : strength === 2 ? "bg-party-r-soft" : "bg-party-r-faint text-party-r-ink"),
        className,
      )}
      title={ratingLabel[rating]}
    >
      {ratingLabel[rating]}
    </span>
  );
}

export function TierBadge({ tier, className }: { tier?: Tier; className?: string }) {
  if (!tier) return null;
  const label = tier === "A" ? "Official feed" : tier === "B" ? "County feeds" : "Delayed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] uppercase tracking-wider",
        tier === "A" && "border-live/50 text-live",
        tier === "B" && "border-stale/50 text-stale",
        tier === "C" && "border-muted-foreground/40 text-muted-foreground",
        className,
      )}
      title={`Tier ${tier}: ${label}`}
    >
      {tier} · {label}
    </span>
  );
}

export function PartyDot({ party, className }: { party: Party; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        party === "D" ? "bg-party-d" : party === "R" ? "bg-party-r" : party === "O" ? "bg-party-o" : "bg-party-i",
        className,
      )}
    />
  );
}
