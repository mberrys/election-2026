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

const FLAG_LABEL = { litigation: "Litigation", "set-aside": "Ballots set aside", "count-paused": "Count paused", advisory: "Advisory" } as const;

/**
 * One ledger row per watch state, worst first: stalled counts, then legal flags, then the quiet watch list.
 * Each row carries the live state of its statewide races so a problem and its stakes sit on one line.
 * Watch states need 90% of the expected vote before any model call (mathematically decided calls are unaffected).
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

  const rows = watch
    .map(({ state: st, reasons, base }) => {
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
      const severity = alerts.length || reasons.includes("Stalled count") ? 2 : flags.length ? 1 : 0;
      return { st, name, reasons, base, statewide, feed, alerts, flags, severity };
    })
    .sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));

  const attention = rows.filter((r) => r.severity > 0).length;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-1 border-b py-4">
        <CardTitle className="text-base font-semibold">
          Integrity watch
          <span className="ml-2 text-sm font-normal text-muted-foreground tnum">
            {rows.length} states · {attention ? `${attention} flagged` : "none flagged"}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Model projections in these states wait until {Math.round(WATCH_MIN_PCT * 100)}% of the expected vote is in. A state joins when
          litigation, set-aside ballots, a paused count or an advisory is posted, or when a county stops reporting.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <div className="hidden grid-cols-[9rem_minmax(0,1.3fr)_minmax(0,1.4fr)_9rem] gap-x-4 border-b px-4 py-2 text-xs text-muted-foreground md:grid">
          <span>State</span>
          <span>Statewide races</span>
          <span>Why watched</span>
          <span className="text-right">Feed</span>
        </div>
        <ul>
          {rows.map((r) => (
            <li
              key={r.st}
              className={cn(
                "grid gap-x-4 gap-y-1 border-b border-l-2 border-b-border/50 px-4 py-2.5 text-sm last:border-b-0 md:grid-cols-[9rem_minmax(0,1.3fr)_minmax(0,1.4fr)_9rem]",
                r.severity === 2 ? "border-l-destructive" : r.severity === 1 ? "border-l-stale" : "border-l-transparent",
              )}
            >
              <div className="flex items-baseline justify-between gap-2 md:block">
                <Link href={`/state/${r.st}`} className="font-medium hover:underline underline-offset-2">
                  {r.name}
                </Link>
                <span className="text-xs md:hidden">
                  <FeedCell st={r.st} feed={r.feed} />
                </span>
              </div>
              <ul className="space-y-1">
                {r.statewide.length === 0 && <li className="text-xs text-muted-foreground">House races only, see state board</li>}
                {r.statewide.map((m) => {
                  const lr = live.get(m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{m.office === "senate" ? `Senate${m.special ? " (special)" : ""}` : "Governor"}</span>
                      <span className="flex items-center gap-2 tnum">
                        {lr?.pctExpected != null && lr.totalVotes > 0 && (
                          <span className="text-muted-foreground">
                            <Pct value={lr.pctExpected * 100} digits={0} /> in
                          </span>
                        )}
                        {lr?.marginDR != null && lr.totalVotes > 0 && <MarginDR value={lr.marginDR} />}
                        <StatusBadge status={lr?.status ?? "not_started"} party={lr?.projection?.party} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <ul className="space-y-1 text-xs">
                {r.base && r.severity === 0 && <li className="text-muted-foreground">Watch list</li>}
                {r.alerts.map((a, i) => (
                  <li key={`a${i}`} className="text-destructive">
                    {a}
                  </li>
                ))}
                {r.reasons
                  .filter((x) => x === "Stalled count" && !r.alerts.length)
                  .map((x) => (
                    <li key={x} className="text-destructive">
                      {x}
                    </li>
                  ))}
                {r.flags.map((f, i) => (
                  <li key={`f${i}`} className="text-stale" title={f.summary}>
                    {FLAG_LABEL[f.kind]}
                    {f.kind === "set-aside" && f.challengedBallots ? `: about ${f.challengedBallots.toLocaleString()} ballots demanded set aside` : ""}
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="ml-1.5 underline underline-offset-2">
                        source
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <div className="hidden text-right text-xs md:block">
                <FeedCell st={r.st} feed={r.feed} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FeedCell({ st, feed }: { st: string; feed?: NonNullable<NationalPayload["feeds"]>[number] }) {
  if (!feed)
    return (
      <span className="text-muted-foreground" title={FEED_NOTE[st]}>
        No live feed yet
      </span>
    );
  return (
    <span className={cn(feed.ok ? "text-muted-foreground" : "text-destructive")}>
      <TierBadge tier={feed.tier} /> {feed.ok ? "" : "feed error"}
    </span>
  );
}
