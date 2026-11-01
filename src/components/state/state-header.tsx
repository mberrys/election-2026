"use client";

import { useNow } from "@/hooks/use-now";
import type { Race, StateMeta } from "@/data/schema";
import { fmtEt, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { mirageInfo, type ModesPresent } from "./derive";

/**
 * Title, poll close and one plain sentence on how the count arrives. Status furniture (vote-mode chips, the
 * "updated" clock) appears only once a snapshot exists, so the pre-election header carries no empty marks.
 */
export function StateHeader({
  state,
  race,
  generatedAt,
  raceCount,
  sourceNote,
}: {
  state: StateMeta;
  race?: Race;
  generatedAt?: string | null;
  raceCount: number;
  /** One muted sentence on where results come from (or why they are missing). */
  sourceNote?: string;
}) {
  const mirage = mirageInfo(state, race);
  const reported = reportedModes(mirage.present);
  const orderKnown = state.voteOrder !== "unknown";
  const split = state.pollCloseFirstEt && state.pollCloseFirstEt !== state.pollCloseEt ? ` (first close ${fmtEt(state.pollCloseFirstEt)})` : "";

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="page-header min-w-0">
        <h1 className="page-title">{state.name}</h1>
        <p className="page-lede tnum">
          Polls close {fmtEt(state.pollCloseEt)} on Tuesday, Nov 3{split}. {raceCount} races tracked.
        </p>
        {(orderKnown || sourceNote) && (
          <p className="max-w-[68ch] text-sm text-muted-foreground" title={mirage.note}>
            {orderKnown && <>{mirage.label}. </>}
            {sourceNote}
          </p>
        )}
        {reported.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Reported so far:{" "}
            {reported.map((m, i) => (
              <span key={m}>
                {i > 0 && ", "}
                <span className="font-medium text-foreground">{m}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      {generatedAt && <LastUpdated iso={generatedAt} />}
    </header>
  );
}

const MODE_LABEL: [keyof ModesPresent, string, string][] = [
  ["early", "Early in-person", "E"],
  ["mail", "Mail", "M"],
  ["eday", "Election Day", "ED"],
];

/** Full names of the vote modes that have reported, in count order. */
export function reportedModes(present: ModesPresent): string[] {
  return MODE_LABEL.filter(([k]) => present[k]).map(([, label]) => label);
}

/** Short codes ("E · M") of the reported modes, for dense table cells. Empty when nothing has reported. */
export function ModeCodes({ present, className }: { present: ModesPresent; className?: string }) {
  const on = MODE_LABEL.filter(([k]) => present[k]);
  if (!on.length) return null;
  return (
    <span className={cn("whitespace-nowrap text-muted-foreground", className)} title={`Reported: ${on.map(([, l]) => l).join(", ")}`}>
      {on.map(([, , code]) => code).join(" · ")}
    </span>
  );
}

/** "Updated 42s ago", ticking once a second. Rendered only once a snapshot exists. */
function LastUpdated({ iso }: { iso: string }) {
  const now = useNow();
  if (now == null) return null;
  const ageS = (now - new Date(iso).getTime()) / 1000;
  return (
    <span className={cn("shrink-0 text-sm tnum", ageS > 180 ? "text-stale" : "text-muted-foreground")}>
      <span className={cn("mr-2 inline-block h-2 w-2 rounded-full align-middle", ageS > 180 ? "bg-stale" : "bg-live")} />
      Updated {timeAgo(iso, now)}
    </span>
  );
}
