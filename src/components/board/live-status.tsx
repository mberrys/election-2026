"use client";

import { useNational } from "@/hooks/use-results";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header pill: pulsing dot + "Updated 12s ago". Clock runs only on the client to keep the shell static. */
export function LiveStatus() {
  const { data, isError, isFetching } = useNational();
  const now = useNow();

  const generatedAt = now ? (data?.generatedAt ?? undefined) : undefined; // before mount, render the server-identical idle state
  const ageSec = generatedAt && now ? (now - new Date(generatedAt).getTime()) / 1000 : null;
  const state: "live" | "stale" | "idle" | "error" = isError
    ? "error"
    : !generatedAt
      ? "idle"
      : ageSec != null && ageSec > 240
        ? "stale"
        : "live";

  const label =
    state === "error"
      ? "Feed error"
      : state === "idle"
        ? "Awaiting first results"
        : `Updated ${now ? timeAgo(generatedAt, now) : "—"}`;

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground tnum"
      title={data ? `snapshot #${data.seq}` : undefined}
    >
      <span className="relative flex h-2 w-2">
        {state === "live" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            state === "live" && "bg-live",
            state === "stale" && "bg-stale",
            state === "idle" && "bg-muted-foreground/50",
            state === "error" && "bg-destructive",
          )}
        />
      </span>
      <span>{label}</span>
      {isFetching && <span className="sr-only">Refreshing</span>}
    </div>
  );
}
