"use client";

import Link from "next/link";
import { ratingLean } from "@/analytics";
import { MarginDR, Pct } from "@/components/board/num";
import { PartyDot, RatingBadge } from "@/components/board/status-badge";
import type { Party, RaceMeta } from "@/data/schema";
import { ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flippedTo, isCalled, type LiveRace } from "@/components/senate/balance";

const PARTY_RANK = { D: 0, R: 1, I: 2, L: 3, G: 3, O: 4 } as const;

/** Tile colour: projection wins; otherwise the consensus rating tint; toss-ups grey. */
function tileClasses(projected: Party | undefined, rating: RaceMeta["ratings"]["consensus"], leader: Party | undefined, counting: boolean) {
  if (projected === "D") return "bg-party-d text-white border-party-d";
  if (projected === "R") return "bg-party-r text-white border-party-r";
  if (projected) return "bg-party-i text-black border-party-i";
  const lean = ratingLean(rating);
  const strong = rating?.startsWith("solid") || rating?.startsWith("likely");
  // The vote leader is drawn as a full-strength border; the fill carries the rating and stays pale so called seats are the loudest tiles.
  const edge = (p: "d" | "r") => (counting && leader === p.toUpperCase() ? (p === "d" ? "border-party-d" : "border-party-r") : p === "d" ? "border-party-d/40" : "border-party-r/40");
  if (lean === "D") return cn(strong ? "bg-party-d-faint" : "bg-party-d-faint/45", edge("d"));
  if (lean === "R") return cn(strong ? "bg-party-r-faint" : "bg-party-r-faint/45", edge("r"));
  return cn("bg-uncalled/40", counting && leader ? (leader === "D" ? "border-party-d" : "border-party-r") : "border-border");
}

export function GovernorTile({ meta, race, stateName }: { meta: RaceMeta; race: LiveRace | undefined; stateName: string }) {
  const called = isCalled(race);
  const projected = called ? race?.projection?.party : undefined;
  const counting = !!race && race.totalVotes > 0;
  const leaderParty = counting ? race?.candidates.find((c) => c.id === race.leaderId)?.party : undefined;
  const flip = flippedTo(meta, race);
  const rating = meta.ratings.consensus;

  const cands = counting && race
    ? [...race.candidates].sort((a, b) => b.votes - a.votes).slice(0, 2)
    : [...meta.candidates].sort((a, b) => PARTY_RANK[a.party] - PARTY_RANK[b.party]).slice(0, 2).map((c) => ({ ...c, pct: undefined as number | undefined }));

  return (
    <Link
      href={`/state/${meta.state}`}
      className={cn(
        "group relative flex min-h-[132px] flex-col rounded-lg border p-2.5 transition-[filter,transform] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        tileClasses(projected, rating, leaderParty, counting),
      )}
      aria-label={`${stateName} governor: ${rating ? ratingLabel[rating] : "unrated"}${called ? ", projected" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="display text-3xl font-bold leading-none tracking-tight">{meta.state}</span>
        <div className="flex flex-col items-end gap-0.5">
          {called ? (
            <span className="rounded bg-black/25 px-1 text-[11px] font-semibold">Called</span>
          ) : (
            <RatingBadge rating={rating} className="text-[11px]" />
          )}
          {flip && <span className="text-[11px] font-semibold">Flip → {flip}</span>}
          {meta.heldBy && !flip && <span className={cn("text-[11px]", called ? "opacity-80" : "text-muted-foreground")}>Held {meta.heldBy}</span>}
        </div>
      </div>

      <ul className={cn("mt-2 space-y-0.5 text-xs", called && "text-white/90")}>
        {cands.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <PartyDot party={c.party} className={cn(called && "ring-1 ring-white/60")} />
            <span className={cn("truncate", c.id === race?.projection?.winnerId && "font-semibold")}>
              {c.name.split(" ").slice(-1)[0]}
              {"incumbent" in c && c.incumbent ? " *" : ""}
            </span>
            {c.pct != null && <Pct value={c.pct} digits={1} className="ml-auto text-[11px]" />}
          </li>
        ))}
      </ul>

      <div className={cn("mt-auto flex items-center justify-between pt-2 text-[11px] tnum", called ? "text-white/90" : "text-muted-foreground")}>
        {counting && race ? (
          <>
            <span>
              <Pct value={(race.pctExpected ?? 0) * 100} digits={0} /> in
            </span>
            <MarginDR value={race.marginDR} className={cn(called && "text-white")} />
          </>
        ) : (
          <>
            <span>{meta.polls ? `Poll ${meta.polls.d > meta.polls.r ? "D" : "R"}+${Math.abs(meta.polls.d - meta.polls.r).toFixed(1)}` : "No poll avg"}</span>
            <span>{race?.status === "runoff" ? "Runoff" : meta.runoffRule === "majority" ? "50% rule" : ""}</span>
          </>
        )}
      </div>
    </Link>
  );
}
