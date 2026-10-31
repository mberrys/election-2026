"use client";

import Link from "next/link";
import { ratingLean } from "@/analytics";
import { MarginDR, Pct } from "@/components/board/num";
import { PartyDot, RatingBadge } from "@/components/board/status-badge";
import { BBStamp, CheckMark } from "@/components/board/hatch";
import type { Party, RaceMeta } from "@/data/schema";
import { ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flippedTo, isCalled, type LiveRace } from "@/components/senate/balance";

const PARTY_RANK = { D: 0, R: 1, I: 2, L: 3, G: 3, O: 4 } as const;
const HOLDING = new Set(["count-paused", "litigation", "set-aside"]);

type TileState = "projected" | "decided" | "held" | "leading" | "uncounted";

/**
 * Tile in the Hatch grammar:
 *   projected → solid party fill + BB stamp      decided (certified) → solid fill + ink check
 *   leading   → party tint + dashed party outline
 *   held      → hazard band on the top edge, muted party colours
 *   uncounted → hatch, with the rating as a chip
 */
function tileClasses(state: TileState, party: Party | undefined) {
  const p = party === "D" ? "d" : party === "R" ? "r" : party ? "i" : undefined;
  if (state === "projected" || state === "decided")
    return p === "d"
      ? "border border-party-d bg-party-d text-on-party"
      : p === "r"
        ? "border border-party-r bg-party-r text-on-party"
        : "border border-party-i bg-party-i text-ground";
  if (state === "held")
    return cn("border border-hairline pt-[18px]", p === "d" ? "bg-party-d-muted/40" : p === "r" ? "bg-party-r-muted/40" : "bg-s2");
  // .lead-* carries its own 2px dashed border, so no `border` utility here.
  if (state === "leading") return p === "d" ? "lead-d" : p === "r" ? "lead-r" : "lead-i";
  return "hatch border border-hairline";
}

export function GovernorTile({ meta, race, stateName }: { meta: RaceMeta; race: LiveRace | undefined; stateName: string }) {
  const called = isCalled(race);
  const projected = called ? race?.projection?.party : undefined;
  const counting = !!race && race.totalVotes > 0;
  const leaderParty = counting ? race?.candidates.find((c) => c.id === race.leaderId)?.party : undefined;
  const flip = flippedTo(meta, race);
  const rating = meta.ratings.consensus;
  const holdFlag = counting && !called ? race?.flags?.find((f) => HOLDING.has(f.kind)) : undefined;

  const state: TileState = called
    ? race?.status === "certified"
      ? "decided"
      : "projected"
    : holdFlag
      ? "held"
      : counting && leaderParty
        ? "leading"
        : "uncounted";
  const solid = state === "projected" || state === "decided";
  const lean = ratingLean(rating);
  const tileParty: Party | undefined = solid
    ? (projected ?? race?.candidates.find((c) => c.id === race?.leaderId)?.party)
    : (leaderParty ?? (lean === "tossup" ? undefined : lean));

  const cands = counting && race
    ? [...race.candidates].sort((a, b) => b.votes - a.votes).slice(0, 2)
    : [...meta.candidates].sort((a, b) => PARTY_RANK[a.party] - PARTY_RANK[b.party]).slice(0, 2).map((c) => ({ ...c, pct: undefined as number | undefined }));

  const sub = solid ? "text-on-party/80" : "text-muted-foreground";

  return (
    <Link
      href={`/state/${meta.state}`}
      className={cn(
        "group relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-[3px] p-2.5 transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring",
        tileClasses(state, tileParty),
      )}
      aria-label={`${stateName} governor: ${rating ? ratingLabel[rating] : "unrated"}${called ? ", projected by Big Board" : ""}${holdFlag ? ", count held" : ""}`}
    >
      {state === "held" && <span aria-hidden className="hazard absolute inset-x-0 top-0 h-2.5" />}
      {flip && meta.heldBy && (
        <span
          aria-hidden
          title={`Flipped from ${meta.heldBy}`}
          className={cn("absolute right-0 top-0 h-3 w-3", meta.heldBy === "D" ? "bg-party-d" : meta.heldBy === "R" ? "bg-party-r" : "bg-party-i")}
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
        />
      )}
      <div className="flex items-start justify-between gap-1">
        <span className={cn("display text-[28px] font-extrabold leading-none tracking-tight", state === "held" && "text-muted-foreground")}>{meta.state}</span>
        <div className="flex flex-col items-end gap-1">
          {state === "projected" ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold">
              <BBStamp className="bg-ground text-ink" />
              Projected
            </span>
          ) : state === "decided" ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold">
              <CheckMark /> Certified
            </span>
          ) : (
            <RatingBadge rating={rating} className="rounded-[2px] bg-s1/90 px-1 py-0.5" />
          )}
          {flip && <span className="text-xs font-semibold">Flip to {flip}</span>}
          {meta.heldBy && !flip && <span className={cn("text-xs", sub)}>Held {meta.heldBy}</span>}
        </div>
      </div>

      <ul className="mt-2 space-y-1 text-sm">
        {cands.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <PartyDot party={c.party} className={cn(solid && "ring-1 ring-on-party/60", state === "held" && "opacity-60")} />
            <span
              className={cn(
                "truncate",
                state === "held" && "text-muted-foreground",
                (c.id === race?.projection?.winnerId || (state === "leading" && c.id === race?.leaderId)) && "font-semibold",
              )}
            >
              {c.name.split(" ").slice(-1)[0]}
              {"incumbent" in c && c.incumbent ? " *" : ""}
            </span>
            {c.pct != null && <Pct value={c.pct} digits={1} className="ml-auto text-xs" />}
          </li>
        ))}
      </ul>

      <div className={cn("mt-auto flex items-center justify-between gap-2 pt-2 text-xs tnum", sub)}>
        {holdFlag ? (
          <span className="font-semibold text-alert-ink" title={holdFlag.summary}>
            {holdFlag.kind === "count-paused" ? "Count paused" : holdFlag.kind === "litigation" ? "In litigation" : "Ballots set aside"}
          </span>
        ) : counting && race ? (
          <>
            <span>
              <Pct value={(race.pctExpected ?? 0) * 100} digits={0} /> in
            </span>
            <MarginDR value={race.marginDR} className={cn(solid && "text-on-party")} />
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
