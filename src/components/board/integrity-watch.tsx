"use client";

import Link from "next/link";
import type { NationalPayload, RaceMeta, StateMeta } from "@/data/schema";
import { resolveWatch, WATCH_MIN_PCT } from "@/data/watch";
import { annotationsFor, ANNOTATIONS } from "@/data/annotations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarginDR, Pct } from "./num";
import { StatusBadge, TierBadge } from "./status-badge";
import { cn } from "@/lib/utils";

type Live = NationalPayload["races"][number];

const FEED_NOTE: Record<string, string> = {
  AK: "State precinct CSV",
  CA: "Secretary of State API",
  GA: "Enhanced Voting (awaiting Nov 3 election to be published)",
  MI: "County feeds",
  AZ: "County feeds",
  WA: "Secretary of State",
};

/**
 * One row per watch state: statewide races, live status, legal flags and stall alerts. Watch states need
 * 90% of the expected vote before any model call (mathematically decided calls are unaffected).
 */
export function IntegrityWatch({
  metas,
  states,
  live,
  payload,
}: {
  metas: RaceMeta[];
  states: StateMeta[];
  live: Map<string, Live>;
  payload?: NationalPayload;
}) {
  const stateName = new Map(states.map((s) => [s.abbr, s.name]));
  const feeds = payload?.feeds ?? [];
  // Dynamic list from the latest ingest (base + annotated + stalled states); static fallback before the first snapshot.
  const watch = payload?.watch?.length ? payload.watch : resolveWatch({ annotations: ANNOTATIONS });
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
          Integrity watch · {watch.length} states
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Starts with states at highest risk of ballot disputes; any state joins automatically when litigation, a ballot
          set-aside, a paused count or an advisory is posted, or when a county stops reporting. Model projections here wait
          until {Math.round(WATCH_MIN_PCT * 100)}% of the expected vote is in.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {watch.map(({ state: st, reasons, base }) => {
          const name = stateName.get(st) ?? st;
          const statewide = metas.filter((m) => m.state === st && (m.office === "senate" || m.office === "governor"));
          const feed = feeds.find((f) => f.states.includes(st) || f.states.includes("ALL"));
          const alerts = (payload?.notices ?? []).filter((n) => n.includes("stalled") && n.includes(name));
          const flags = [
            ...new Map(
              statewide
                .flatMap((m) => live.get(m.id)?.flags ?? annotationsFor(m))
                .map((f) => [`${f.kind}|${f.summary}`, f] as const),
            ).values(),
          ];
          return (
            <div
              key={st}
              className={cn(
                "rounded-md border p-3 text-sm",
                alerts.length ? "border-destructive/60 bg-destructive/5" : flags.length ? "border-stale/40" : "border-border/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Link href={`/state/${st}`} className="font-semibold hover:underline underline-offset-2">
                  {name}
                </Link>
                {feed ? (
                  <span className={cn("text-[10px]", feed.ok ? "text-muted-foreground" : "text-destructive")}>
                    <TierBadge tier={feed.tier} /> {feed.ok ? "" : "feed error"}
                  </span>
                ) : (
                  <span className="text-[10px] text-destructive" title={FEED_NOTE[st]}>
                    No live feed yet
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {base && <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">Watch list</span>}
                {reasons.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "rounded px-1.5 py-px text-[10px] font-medium",
                      r === "Stalled count" ? "bg-destructive/15 text-destructive" : "bg-stale/15 text-stale",
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
              <ul className="mt-2 space-y-1">
                {statewide.length === 0 && <li className="text-xs text-muted-foreground">House races only — see state board</li>}
                {statewide.map((m) => {
                  const r = live.get(m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{m.office === "senate" ? `Senate${m.special ? " (special)" : ""}` : "Governor"}</span>
                      <span className="flex items-center gap-2 tnum">
                        {r?.pctExpected != null && r.totalVotes > 0 && <Pct value={r.pctExpected * 100} digits={0} />}
                        {r?.marginDR != null && r.totalVotes > 0 && <MarginDR value={r.marginDR} />}
                        <StatusBadge status={r?.status ?? "not_started"} party={r?.projection?.party} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              {flags.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {flags.map((f, i) => (
                    <li key={i} className="text-[11px] text-stale" title={f.summary}>
                      ⚖ {f.kind === "set-aside" ? `~${(f.challengedBallots ?? 0).toLocaleString()} ballots demanded set aside` : f.kind === "count-paused" ? "Count paused" : f.kind === "advisory" ? "Advisory" : "Litigation"}
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 underline underline-offset-2">
                          source
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {alerts.map((a, i) => (
                <p key={i} className="mt-2 text-[11px] text-destructive">
                  ⚠ {a}
                </p>
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
