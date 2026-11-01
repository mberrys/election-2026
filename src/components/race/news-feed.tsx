"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNow } from "@/hooks/use-now";
import type { NewsItem, NewsPayload } from "@/lib/news";

const REFRESH_MS = 5 * 60_000;
const PAGE_SIZE = 6;

async function getNews(raceId: string): Promise<NewsPayload> {
  const res = await fetch(`/api/news?race=${encodeURIComponent(raceId)}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`news ${raceId} → ${res.status}`);
  return res.json() as Promise<NewsPayload>;
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". Empty when the time is unknown or not yet hydrated. */
function ago(iso: string, now: number | null): string {
  const t = Date.parse(iso);
  if (now === null || Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Tracks which URLs are new since the previous fetch, for exactly one refresh cycle. */
function useFreshUrls(raceId: string, data: NewsPayload | undefined, stamp: number): Set<string> {
  const [track, setTrack] = useState<{ raceId: string; stamp: number; seen: Set<string> | null; fresh: Set<string> }>({
    raceId,
    stamp: 0,
    seen: null,
    fresh: new Set(),
  });
  if (data && (track.raceId !== raceId || track.stamp !== stamp)) {
    const urls = data.items.map((i) => i.url);
    const sameRace = track.raceId === raceId;
    const previous = sameRace ? track.seen : null;
    setTrack({
      raceId,
      stamp,
      seen: new Set([...(previous ?? []), ...urls]),
      fresh: previous ? new Set(urls.filter((u) => !previous.has(u))) : new Set(),
    });
  }
  return track.raceId === raceId ? track.fresh : new Set();
}

function Row({ item, now, isNew }: { item: NewsItem; now: number | null; isNew: boolean }) {
  const when = ago(item.publishedAt, now);
  return (
    <li className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className={isNew ? "border-l-2 border-signal pl-3" : undefined}>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-pretty text-[17px] font-semibold leading-snug text-foreground hover:underline"
        >
          {item.title}
        </a>
        <p className="mt-1 text-sm text-ink-muted">
          {item.outlet}
          {when ? ` · ${when}` : ""}
        </p>
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <ul aria-hidden className="m-0 list-none p-0">
      {[0, 1, 2].map((i) => (
        <li key={i} className="border-t border-border py-4 first:border-t-0 first:pt-0">
          <div className="h-5 w-11/12 bg-s3" />
          <div className="mt-2 h-4 w-1/3 bg-s3" />
        </li>
      ))}
    </ul>
  );
}

const linkButton =
  "text-sm text-ink-muted underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export function NewsFeed({ raceId, title = "Latest news" }: { raceId: string; title?: string }) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const now = useNow();
  const query = useQuery({
    queryKey: ["news", raceId],
    queryFn: () => getNews(raceId),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS - 30_000,
    retry: 1,
  });
  const fresh = useFreshUrls(raceId, query.data, query.dataUpdatedAt);

  const items = query.data?.items ?? [];
  const visible = expanded ? items : items.slice(0, PAGE_SIZE);
  const hidden = items.length - visible.length;

  let note: string | null = null;
  if (query.data) {
    const via = query.data.source === "gdelt" ? "Headlines via GDELT" : query.data.source === "google-news" ? "Headlines via Google News" : "Headlines";
    const updated = ago(query.data.fetchedAt, now);
    note = updated ? `${via} · updated ${updated}` : via;
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">
        {title}
      </h2>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}

      <div className="mt-4">
        {query.isPending ? (
          <Skeleton />
        ) : query.isError && !query.data ? (
          <p className="text-sm text-ink-muted">
            Headlines could not be loaded.{" "}
            <button type="button" onClick={() => void query.refetch()} className={linkButton}>
              Try again
            </button>
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-muted">No recent coverage found for this race.</p>
        ) : (
          <>
            <ul className="m-0 list-none p-0">
              {visible.map((item) => (
                <Row key={item.url} item={item} now={now} isNew={fresh.has(item.url)} />
              ))}
            </ul>
            {hidden > 0 && (
              <button type="button" onClick={() => setExpanded(true)} className={`mt-4 ${linkButton}`}>
                Show more
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
