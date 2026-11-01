"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { shortDate } from "@/components/state/state-content";

/**
 * 2024 national House popular vote, D − R points.
 * TODO verify before launch: R 49.8% / D 47.2% → R+2.6 per the Cook Political Report national House vote tracker and
 * Wikipedia "2024 United States House of Representatives elections" (certified totals).
 */
export const HOUSE_NATIONAL_MARGIN_2024_DR = -2.6;
export const HOUSE_NATIONAL_MARGIN_2024_SOURCE =
  "2024 national House popular vote: R 49.8%, D 47.2% (Cook Political Report national House vote tracker; Wikipedia, 2024 U.S. House elections).";

/** Plain-object shape of polls.json → generic (see src/data/reference/load.ts GenericBallot). */
export type GenericBallotData = {
  riotimes?: { d: number; r: number; margin: number; asOf: string; method?: string; license?: string; sources?: unknown[] };
  votehub?: { d: number; r: number; n: number; asOf: string; source?: string; windowDays?: number; pollsters?: number };
};

const AXIS = 15; // bar spans D+15 … R+15, D on the left like every other margin scale on the site

type Marker = { key: string; label: string; value: number; detail: string; kind: "avg" | "baseline" };

export function GenericBallotPanel({ generic, className }: { generic: GenericBallotData | undefined; className?: string }) {
  const markers: Marker[] = [];
  if (generic?.riotimes) {
    const g = generic.riotimes;
    markers.push({
      key: "rio",
      label: "Rio Times 5-avg",
      value: g.d - g.r,
      kind: "avg",
      detail: `D ${g.d.toFixed(1)} · R ${g.r.toFixed(1)} · as of ${g.asOf}${g.method ? ` · ${g.method}` : ""}`,
    });
  }
  if (generic?.votehub) {
    const v = generic.votehub;
    markers.push({
      key: "votehub",
      label: "VoteHub avg",
      value: v.d - v.r,
      kind: "avg",
      detail: `D ${v.d.toFixed(1)} · R ${v.r.toFixed(1)} · ${v.n} polls${v.windowDays ? ` / ${v.windowDays}d` : ""} · as of ${v.asOf}`,
    });
  }
  markers.push({
    key: "2024",
    label: "2024 House vote",
    value: HOUSE_NATIONAL_MARGIN_2024_DR,
    kind: "baseline",
    detail: HOUSE_NATIONAL_MARGIN_2024_SOURCE,
  });

  const pos = (v: number) => `${((AXIS - Math.max(-AXIS, Math.min(AXIS, v))) / (2 * AXIS)) * 100}%`;
  const hasPolls = markers.some((m) => m.kind === "avg");

  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle>Generic ballot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasPolls && <p className="text-sm text-muted-foreground">No generic-ballot averages in the reference data.</p>}
        <div className="relative pt-6 pb-5">
          {/* axis */}
          <div className="flex h-2 gap-px overflow-hidden rounded-sm" aria-hidden>
            <div className="flex-1 bg-party-d-soft" />
            <div className="flex-1 bg-uncalled/50" />
            <div className="flex-1 bg-party-r-soft" />
          </div>
          <div className="absolute inset-x-0 top-6 h-2 flex justify-between text-xs text-muted-foreground tnum -translate-y-5">
            <span>D+{AXIS}</span>
            <span>Even</span>
            <span>R+{AXIS}</span>
          </div>
          {/* even tick */}
          <div className="absolute left-1/2 top-5 h-4 w-px bg-foreground/40 -translate-x-1/2" aria-hidden />
          {markers.map((m) => (
            <Tooltip key={m.key}>
              <TooltipTrigger
                className={cn(
                  "absolute -translate-x-1/2 flex flex-col items-center outline-none focus-visible:ring-2 ring-ring rounded",
                  m.kind === "avg" ? "top-4" : "top-5",
                )}
                style={{ left: pos(m.value) }}
                aria-label={`${m.label}: ${fmtMarginDR(m.value)}`}
              >
                {m.kind === "avg" ? (
                  <span className="block h-6 w-[3px] rounded-full bg-foreground outline outline-1 outline-background" />
                ) : (
                  <span className="block h-4 w-[2px] bg-muted-foreground" />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <span>
                  <strong>{m.label}</strong>: {fmtMarginDR(m.value)}
                  <br />
                  <span className="opacity-80">{m.detail}</span>
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ul className="grid gap-1.5 text-sm">
          {markers.map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className={cn("inline-block h-3 rounded-full", m.kind === "avg" ? "w-[3px] bg-foreground" : "w-[2px] bg-muted-foreground")} />
                {m.label}
                {m.kind === "avg" && <span>· {shortDate(m.key === "rio" ? generic?.riotimes?.asOf : generic?.votehub?.asOf)}</span>}
              </span>
              <span className={cn("tnum font-semibold", m.value > 0 ? "text-party-d-ink" : m.value < 0 ? "text-party-r-ink" : "")}>{fmtMarginDR(m.value)}</span>
            </li>
          ))}
        </ul>
        {hasPolls && (
          <p className="text-xs leading-snug text-muted-foreground">
            {shiftSentence(markers)} Averages: Rio Times (equal-weight mean of public averages) and VoteHub, both CC BY 4.0.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** "The averages are D+11.2 and D+9.6 relative to the 2024 House vote." */
function shiftSentence(markers: Marker[]): string {
  const shifts = markers.filter((m) => m.kind === "avg").map((m) => fmtMarginDR(m.value - HOUSE_NATIONAL_MARGIN_2024_DR));
  if (!shifts.length) return "";
  return shifts.length === 1
    ? `The average is ${shifts[0]} relative to the 2024 House vote.`
    : `The averages are ${shifts.slice(0, -1).join(", ")} and ${shifts[shifts.length - 1]} relative to the 2024 House vote.`;
}
