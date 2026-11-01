"use client";

import { useNational } from "@/hooks/use-results";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FreshDot } from "./hatch";

type FeedState = "live" | "stale" | "idle" | "error";

/** Snapshots older than this read as stale (grey) instead of live (chartreuse). */
const STALE_AFTER_SEC = 240;

/** Poll-close window, Nov 3 2026 (EST): first closings 6 pm ET (IN, KY) to the last at 1 am ET (western Alaska). */
const WINDOW_START = Date.parse("2026-11-03T23:00:00Z");
const WINDOW_END = Date.parse("2026-11-04T06:00:00Z");

/** Feed freshness shared by the header pill and the top rail. The clock runs only on the client to keep the shell static. */
function useFreshness() {
  const { data, isError, isFetching } = useNational();
  const now = useNow();
  const generatedAt = now ? (data?.generatedAt ?? undefined) : undefined; // before mount, render the server-identical idle state
  const ageSec = generatedAt && now ? (now - new Date(generatedAt).getTime()) / 1000 : null;
  const state: FeedState = isError ? "error" : !generatedAt ? "idle" : ageSec != null && ageSec > STALE_AFTER_SEC ? "stale" : "live";
  // In simulation the night runs on the sim clock carried in the notice, so the rail follows it.
  const simClock = data?.notices?.find((n) => n.startsWith("SIMULATION"))?.match(/sim clock ([0-9T:.-]+Z)/)?.[1];
  const clock = now == null ? null : simClock ? Date.parse(simClock) : now;
  const elapsed = clock == null ? 0 : Math.max(0, Math.min(1, (clock - WINDOW_START) / (WINDOW_END - WINDOW_START)));
  return { data, isFetching, now, generatedAt, state, elapsed };
}

/** Header pill: freshness dot + "Updated 12s ago". */
export function LiveStatus() {
  const { data, isFetching, now, generatedAt, state } = useFreshness();
  // Before the first polls close there is nothing live to signal: say when the night starts, with no dot.
  if (now == null || now < WINDOW_START) {
    return <div className="whitespace-nowrap text-sm font-medium text-muted-foreground max-sm:hidden">Election Day · Tue, Nov 3</div>;
  }
  const label =
    state === "error" ? "Feed error" : state === "idle" ? "Awaiting first results" : `Updated ${now ? timeAgo(generatedAt, now) : "—"}`;

  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground tnum"
      title={data ? `snapshot #${data.seq}` : undefined}
    >
      {state === "live" ? (
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-50 motion-reduce:hidden" />
          <FreshDot state="live" className="relative" />
        </span>
      ) : state === "error" ? (
        <FreshDot state="held" />
      ) : (
        <FreshDot state="stale" />
      )}
      <span className={cn("max-sm:sr-only", state === "error" && "text-alert-ink")}>{label}</span>
      {isFetching && <span className="sr-only">Refreshing</span>}
    </div>
  );
}

/**
 * 3px rail across the very top of the page. Width = share of the poll-close window elapsed; chartreuse while the
 * feed is fresh, grey (#6B7383) once it goes stale. Before polls start closing the track is empty.
 */
export function FreshnessRail() {
  const { state, elapsed } = useFreshness();
  const fresh = state === "live" || (state === "idle" && elapsed === 0);
  return (
    <div
      className="h-[3px] w-full bg-hairline"
      role="progressbar"
      aria-label="Share of the poll-closing window elapsed"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(elapsed * 100)}
    >
      <div className={cn("h-full anim-bar", fresh ? "bg-signal" : "bg-stale")} style={{ width: `${elapsed * 100}%` }} />
    </div>
  );
}
