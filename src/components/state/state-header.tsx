"use client";

import { useNow } from "@/hooks/use-now";
import type { Race, StateMeta, Tier } from "@/data/schema";
import { TierBadge } from "@/components/board/status-badge";
import { fmtEt, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { mirageInfo, type ModesPresent } from "./derive";

export function StateHeader({
  state,
  tier,
  race,
  generatedAt,
  raceCount,
}: {
  state: StateMeta;
  tier?: Tier;
  race?: Race;
  generatedAt?: string | null;
  raceCount: number;
}) {
  const mirage = mirageInfo(state, race);
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>State board</span>
          <span aria-hidden>·</span>
          <span className="tnum">
            Polls close {fmtEt(state.pollCloseEt)}
            {state.pollCloseFirstEt && state.pollCloseFirstEt !== state.pollCloseEt ? ` (first ${fmtEt(state.pollCloseFirstEt)})` : ""}
          </span>
          <span aria-hidden>·</span>
          <span className="tnum">{raceCount} races tracked</span>
        </div>
        <h1 className="display text-4xl md:text-5xl font-bold leading-none tracking-tight mt-1">{state.name}</h1>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={tier} />
          <MirageBadge label={mirage.label} lean={mirage.lean} present={mirage.present} note={mirage.note} />
        </div>
        <LastUpdated iso={generatedAt ?? undefined} />
      </div>
    </header>
  );
}

function MirageBadge({ label, lean, present, note }: { label: string; lean: "D" | "R" | null; present: ModesPresent; note?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] leading-tight",
        lean === "D" && "border-party-d/50 bg-party-d-faint text-foreground",
        lean === "R" && "border-party-r/50 bg-party-r-faint text-foreground",
        lean === null && "border-border text-muted-foreground",
      )}
      title={note ?? label}
    >
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-1" aria-label="Vote modes reported so far">
        <ModeChip on={present.early} label="E" title="Early in-person" />
        <ModeChip on={present.mail} label="M" title="Mail" />
        <ModeChip on={present.eday} label="ED" title="Election Day" />
      </span>
    </span>
  );
}

export function ModeChip({ on, label, title, className }: { on: boolean; label: string; title?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-semibold tracking-wide",
        on ? "bg-live/20 text-live" : "bg-muted text-muted-foreground/60 line-through decoration-muted-foreground/40",
        className,
      )}
      title={`${title ?? label}: ${on ? "reported" : "not yet"}`}
      aria-label={`${title ?? label} ${on ? "reported" : "not yet reported"}`}
    >
      {label}
    </span>
  );
}


/** "Updated 42s ago", ticking once a second. */
function LastUpdated({ iso }: { iso?: string }) {
  const now = useNow();
  if (now == null) return <span className="text-[11px] text-muted-foreground">&nbsp;</span>;
  if (!iso) return <span className="text-[11px] text-muted-foreground">No live snapshot yet</span>;
  const ageS = (now - new Date(iso).getTime()) / 1000;
  return (
    <span className={cn("text-[11px] tnum", ageS > 180 ? "text-stale" : "text-muted-foreground")}>
      <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", ageS > 180 ? "bg-stale" : "bg-live")} />
      Updated {timeAgo(iso, now)}
    </span>
  );
}
