"use client";

import { raceHref } from "@/lib/race-slug";
import Link from "next/link";
import { MarginDR, Pct } from "@/components/board/num";
import { RatingBadge } from "@/components/board/status-badge";
import { BBStamp, CheckMark } from "@/components/board/hatch";
import type { Party, RaceMeta } from "@/data/schema";
import { fmtMarginDR, ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flippedTo, isCalled, isCompetitive, partyInk, pollMargin, type LiveRace } from "@/components/senate/balance";

const PARTY_RANK = { D: 0, R: 1, I: 2, L: 3, G: 3, O: 4 } as const;
const HOLDING = new Set(["count-paused", "litigation", "set-aside"]);
const HOLD_LABEL: Record<string, string> = { "count-paused": "Count paused", litigation: "In litigation", "set-aside": "Ballots set aside" };

type TileState = "projected" | "decided" | "held" | "counting" | "uncounted";

/**
 * One status mark per tile, top right:
 *   uncounted → the consensus rating as coloured text, on a flat card
 *   counting  → the current lead (D+/R+ margin), on a flat card
 *   held      → hazard band on the top edge and the hold reason in amber
 *   projected → solid party fill + BB stamp      decided (certified) → solid fill + check
 * Who holds the seat now lives in the table below, not on the tile.
 */
function tileClasses(state: TileState, party: Party | undefined) {
  if (state === "projected" || state === "decided")
    return party === "D"
      ? "border border-party-d bg-party-d text-on-party"
      : party === "R"
        ? "border border-party-r bg-party-r text-on-party"
        : "border border-party-i bg-party-i text-ground";
  if (state === "held") return "border border-border bg-card pt-[18px]";
  return "border border-border bg-card";
}

export function GovernorTile({ meta, race, stateName }: { meta: RaceMeta; race: LiveRace | undefined; stateName: string }) {
  const called = isCalled(race);
  const counting = !!race && race.totalVotes > 0;
  const flip = flippedTo(meta, race);
  const rating = meta.ratings.consensus;
  const holdFlag = counting && !called ? race?.flags?.find((f) => HOLDING.has(f.kind)) : undefined;

  const state: TileState = called ? (race?.status === "certified" ? "decided" : "projected") : holdFlag ? "held" : counting ? "counting" : "uncounted";
  const solid = state === "projected" || state === "decided";
  const winnerParty = solid ? (race?.projection?.party ?? race?.candidates.find((c) => c.id === race?.leaderId)?.party) : undefined;

  const cands =
    counting && race
      ? [...race.candidates].sort((a, b) => b.votes - a.votes).slice(0, 2)
      : [...meta.candidates]
          .sort((a, b) => PARTY_RANK[a.party] - PARTY_RANK[b.party] || Number(b.incumbent) - Number(a.incumbent))
          .slice(0, 2)
          .map((c) => ({ ...c, pct: undefined as number | undefined }));

  const sub = solid ? "text-on-party/80" : "text-muted-foreground";
  const poll = pollMargin(meta);

  return (
    <Link
      href={raceHref(meta.id)}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg p-3.5 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring",
        solid && "hover:brightness-110",
        tileClasses(state, winnerParty),
      )}
      aria-label={`${stateName} governor: ${rating ? ratingLabel[rating] : "unrated"}${called ? ", projected by Big Board" : ""}${holdFlag ? ", count held" : ""}`}
    >
      {state === "held" && <span aria-hidden className="hazard absolute inset-x-0 top-0 h-2.5" />}

      <div className="flex items-baseline justify-between gap-2">
        <span className="display text-2xl font-bold leading-none">{meta.state}</span>
        {state === "projected" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <BBStamp className="bg-ground text-ink" />
            Projected
          </span>
        ) : state === "decided" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <CheckMark /> Certified
          </span>
        ) : state === "held" && holdFlag ? (
          <span className="text-xs font-semibold text-alert-ink" title={holdFlag.summary}>
            {HOLD_LABEL[holdFlag.kind]}
          </span>
        ) : state === "counting" ? (
          <MarginDR value={race?.marginDR} className="text-sm font-semibold" />
        ) : (
          <RatingBadge rating={rating} className="text-sm font-semibold" />
        )}
      </div>

      <ul className="mt-3 space-y-0.5 text-[15px]">
        {cands.map((c) => {
          const lead = c.id === race?.projection?.winnerId || (state === "counting" && c.id === race?.leaderId);
          return (
            <li key={c.id} className="flex items-baseline gap-1.5">
              <span className={cn("min-w-0 truncate", !solid && partyInk(c.party), lead && "font-semibold")}>{c.name.split(" ").slice(-1)[0]}</span>
              {"incumbent" in c && c.incumbent && <span className={cn("shrink-0 text-xs", sub)}>(inc.)</span>}
              {c.pct != null && <Pct value={c.pct} digits={1} className="ml-auto shrink-0 text-xs" />}
            </li>
          );
        })}
      </ul>

      <div className={cn("mt-auto flex items-center justify-between gap-2 pt-3 text-xs tnum", sub)}>
        {counting && race ? (
          <>
            <span>
              <Pct value={(race.pctExpected ?? 0) * 100} digits={0} /> in
            </span>
            {solid && <span className="font-semibold text-on-party">{flip ? `Flip from ${meta.heldBy}` : fmtMarginDR(race.marginDR)}</span>}
          </>
        ) : race?.status === "runoff" ? (
          <span>Runoff</span>
        ) : poll != null ? (
          <span>Poll {fmtMarginDR(poll)}</span>
        ) : isCompetitive(rating) ? (
          <span>No polls</span>
        ) : null}
      </div>
    </Link>
  );
}
