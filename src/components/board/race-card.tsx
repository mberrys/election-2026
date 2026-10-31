"use client";

import Link from "next/link";
import type { Race, RaceMeta } from "@/data/schema";
import { Card } from "@/components/ui/card";
import { Pct } from "./num";
import { RatingBadge, StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { RaceFlags } from "./race-flags";
import { annotationsFor } from "@/data/annotations";

type LiveRace = Omit<Race, "units"> | Race;
type Cand = { id: string; name: string; party: string; incumbent?: boolean; votes: number; pct: number };

/** The widest margin the lane can show, in points; anything beyond pins to the end of the lane. */
const LANE_CAP = 20;

const surname = (name: string) => name.split(" ").filter((p) => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p)).pop() ?? name;
const lastName = (c: { name: string }) => surname(c.name).toLowerCase();
const pos = (v: number) => 50 + (50 * Math.max(-LANE_CAP, Math.min(LANE_CAP, v))) / LANE_CAP;

/** The nominee of a party: the vote leader once votes exist, otherwise the incumbent, then the best-documented filer. */
function pick(list: Cand[], party: "D" | "R", counting: boolean): Cand | undefined {
  const side = list.filter((c) => c.party === party);
  if (counting) return [...side].sort((a, b) => b.votes - a.votes)[0];
  const rank = (c: Cand) => (c.incumbent ? 2 : 0) - (!c.incumbent && list.some((o) => o.incumbent && o !== c && lastName(o) === lastName(c)) ? 3 : 0);
  return [...side].sort((a, b) => rank(b) - rank(a))[0];
}

/**
 * Race card as a margin lane: the two main candidates face each other across a centre line, the bar is the
 * current margin, and the pale span (once votes are in) is the model's range for the final margin, so how much
 * is still unsettled is drawn rather than implied. Before votes the lane is empty and says so.
 */
export function RaceCard({ live, meta, href, className }: { live?: LiveRace; meta?: RaceMeta; href?: string; className?: string }) {
  const title = live?.name ?? meta?.name ?? "Race";
  const counting = !!live && live.totalVotes > 0 && live.candidates.length > 0;
  const field: Cand[] = counting
    ? live!.candidates
    : (meta?.candidates ?? []).map((c) => ({ ...c, votes: 0, pct: 0 }));
  const d = pick(field, "D", counting);
  const r = pick(field, "R", counting);
  const others = field.filter((c) => c !== d && c !== r);
  const leader = counting ? field.find((c) => c.id === live!.leaderId) : undefined;
  const offLane = leader && leader !== d && leader !== r ? leader : undefined;

  const dr = counting ? live!.marginDR : undefined;
  const model = counting ? live!.model : undefined;
  const pctIn = live?.pctExpected;
  const pctInPts = pctIn != null ? pctIn * (pctIn <= 1 ? 100 : 1) : null;
  const projected = live?.projection;

  const margin =
    dr == null ? "—" : Math.abs(dr) < 0.05 ? "Even" : `${dr > 0 ? "D" : "R"}+${Math.abs(dr).toFixed(1)}`;
  const marginTone = dr == null || Math.abs(dr) < 0.05 ? "text-muted-foreground" : dr > 0 ? "text-party-d-ink" : "text-party-r-ink";
  const lo = model ? pos(model.projectedMarginDR - model.band) : 0;
  const hi = model ? pos(model.projectedMarginDR + model.band) : 0;

  const body = (
    <Card className={cn("gap-2.5 p-3 transition-colors hover:border-foreground/30", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
        <StatusBadge status={live?.status ?? "not_started"} party={projected?.party} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-x-2">
        <Side c={d} counting={counting} winner={projected?.winnerId === d?.id} tone="text-party-d-ink" />
        <span className={cn("display text-2xl font-bold leading-none tnum", marginTone)} aria-label={dr == null ? "No margin yet" : `Margin ${margin}`}>
          {margin}
        </span>
        <Side c={r} counting={counting} winner={projected?.winnerId === r?.id} tone="text-party-r-ink" right />
      </div>

      <div
        role="img"
        aria-label={
          counting && dr != null
            ? `Margin ${margin}${model ? `, projected final range ${fmtRange(model.projectedMarginDR, model.band)}` : ""}`
            : "No votes counted yet"
        }
        className="relative h-3 rounded-sm bg-uncalled/30"
      >
        {model && <div className="absolute inset-y-0 rounded-sm bg-foreground/20" style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} />}
        {dr != null && (
          <div
            className={cn("absolute inset-y-0", dr > 0 ? "bg-party-d" : "bg-party-r")}
            style={{ left: dr > 0 ? "50%" : `${pos(dr)}%`, width: `${Math.abs(pos(dr) - 50)}%` }}
          />
        )}
        <div className="absolute -inset-y-0.5 left-1/2 w-px bg-foreground/70" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground tnum">
        <span>
          {counting && pctInPts != null ? (
            <>
              <Pct value={pctInPts} digits={0} /> of expected vote in
              {model ? <span title="Model range for the final margin"> · final {fmtRange(model.projectedMarginDR, model.band)}</span> : null}
            </>
          ) : (
            "No votes yet"
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <RaceFlags flags={live?.flags ?? (meta ? annotationsFor(meta) : undefined)} />
          {meta?.ratings.consensus && <RatingBadge rating={meta.ratings.consensus} />}
        </span>
      </div>

      {(offLane || others.length > 0) && (
        <div className="text-xs text-muted-foreground">
          {offLane ? (
            <span>
              <span className="font-medium text-foreground">{offLane.name}</span> ({offLane.party}) leads with {offLane.pct.toFixed(1)}%
            </span>
          ) : (
            <span>
              Also on the ballot: {others.slice(0, 2).map((c) => surname(c.name)).join(", ")}
              {others.length > 2 ? ` +${others.length - 2}` : ""}
            </span>
          )}
        </div>
      )}
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

function fmtRange(center: number, band: number) {
  const lead = Math.abs(center) < 0.05 ? "Even" : `${center > 0 ? "D" : "R"}+${Math.abs(center).toFixed(1)}`;
  return `${lead} ± ${band.toFixed(1)}`;
}

function Side({ c, counting, winner, tone, right }: { c?: Cand; counting: boolean; winner: boolean; tone: string; right?: boolean }) {
  if (!c) return <span className={cn("text-xs text-muted-foreground", right && "text-right")}>No nominee</span>;
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      <div className={cn("truncate text-sm", tone, winner ? "font-bold" : "font-medium")}>
        {surname(c.name)}
        {c.incumbent ? <span className="text-muted-foreground"> (inc.)</span> : null}
      </div>
      <div className="text-xs text-muted-foreground tnum">{counting ? <Pct value={c.pct} digits={1} /> : " "}</div>
    </div>
  );
}
