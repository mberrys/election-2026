"use client";

import Link from "next/link";
import type { Race, RaceMeta } from "@/data/schema";
import { Card } from "@/components/ui/card";
import { Pct, Votes } from "./num";
import { PartyDot, RatingBadge, StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { RaceFlags } from "./race-flags";
import { annotationsFor } from "@/data/annotations";

type LiveRace = Omit<Race, "units"> | Race;

type MetaCand = RaceMeta["candidates"][number];
const surname = (c: MetaCand) => c.name.split(" ").pop()?.toLowerCase();
const preRank = (c: MetaCand, all: MetaCand[] = []) =>
  (c.incumbent ? 4 : 0) +
  (c.party === "D" || c.party === "R" ? 2 : 0) +
  (c.fecId ? 1 : 0) -
  // A namesake of the incumbent (AK: Dan J. vs Dan S. Sullivan) is not a main contender.
  (!c.incumbent && all.some((o) => o.incumbent && o !== c && surname(o) === surname(c)) ? 3 : 0);

/**
 * Compact race card: two (or three) candidate rows with vote bars, % expected in, status.
 * Works with live data only, meta only (pre-election), or both.
 */
export function RaceCard({ live, meta, href, className }: { live?: LiveRace; meta?: RaceMeta; href?: string; className?: string }) {
  const title = live?.name ?? meta?.name ?? "—";
  const cands = live?.candidates?.length && live.totalVotes > 0
    ? [...live.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3)
    : [...(meta?.candidates ?? [])]
        // Before votes: incumbents, then major-party nominees with FEC filings, ahead of minor and namesake candidates.
        .sort((a, b) => preRank(b, meta?.candidates) - preRank(a, meta?.candidates))
        .slice(0, 3)
        .map((c) => ({ ...c, votes: 0, pct: 0 }));
  const winnerId = live?.projection?.winnerId;
  const leaderId = live?.leaderId;
  const pctIn = live?.pctExpected;

  const body = (
    <Card className={cn("p-3 gap-2 hover:border-foreground/20 transition-colors", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            {pctIn != null ? (
              <span className="tnum">
                <Pct value={pctIn * (pctIn <= 1 ? 100 : 1)} digits={0} /> of expected vote in
              </span>
            ) : (
              <span>No votes yet</span>
            )}
            {meta?.ratings.consensus && <RatingBadge rating={meta.ratings.consensus} />}
            <RaceFlags flags={live?.flags ?? (meta ? annotationsFor(meta) : undefined)} />
          </div>
        </div>
        <StatusBadge status={live?.status ?? "not_started"} party={live?.projection?.party} />
      </div>
      <ul className="space-y-1">
        {cands.map((c) => {
          const isWinner = c.id === winnerId;
          const isLeader = !winnerId && c.id === leaderId;
          return (
            <li key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 text-sm">
              <div className="min-w-0 flex items-center gap-2">
                <PartyDot party={c.party} />
                <span className={cn("truncate", (isWinner || isLeader) && "font-semibold")}>
                  {c.name}
                  {"incumbent" in c && c.incumbent ? <span className="text-muted-foreground"> *</span> : null}
                </span>
                {isWinner && <span className="text-[10px] text-muted-foreground">✓</span>}
              </div>
              <Votes value={c.votes} className="text-xs text-muted-foreground" />
              <Pct value={c.pct} className="w-14 text-right font-medium" />
              <div className="col-span-3 h-1 rounded-sm bg-uncalled/30 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-[width] duration-700",
                    c.party === "D" ? "bg-party-d" : c.party === "R" ? "bg-party-r" : "bg-party-i",
                  )}
                  style={{ width: `${Math.min(100, c.pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
