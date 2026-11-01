"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { raceHref } from "@/lib/race-slug";
import { ExternalLinkIcon, PinIcon, SearchIcon, XIcon } from "lucide-react";
import type { RaceMeta } from "@/data/schema";
import { StatusBadge } from "@/components/board/status-badge";
import { fmtEt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StateTileMap, type TileLook } from "./state-tile-map";
import { BigStat, FilterChips } from "./seat-bar";
import {
  TOPICS,
  ballotpediaUrl,
  measureDescription,
  measureParts,
  measureTopics,
  yesNo,
  type LiveRace,
  type StateEntry,
  type TopicId,
} from "./states-lib";

type Item = { meta: RaceMeta; st: string; stateName: string; tag?: string; title: string; kind?: string; desc?: string; topics: TopicId[]; haystack: string };

/** Lime steps by how many matching measures a state has. */
const BINS = [
  { min: 7, pct: 100, label: "7+" },
  { min: 4, pct: 80, label: "4–6" },
  { min: 2, pct: 60, label: "2–3" },
  { min: 1, pct: 42, label: "1" },
] as const;
function countFill(n: number): { background: string; ink: "light" | "dark" } {
  const b = BINS.find((x) => n >= x.min) ?? BINS[BINS.length - 1];
  return { background: `color-mix(in oklab, var(--ink) ${b.pct}%, var(--s3))`, ink: b.pct >= 60 ? "dark" : "light" };
}

export function MeasuresView({
  entries,
  live,
  active,
  pinned,
  onPreview,
  onPin,
}: {
  entries: Map<string, StateEntry>;
  live: Map<string, LiveRace>;
  active: string | null;
  pinned: string | null;
  onPreview: (st: string | null) => void;
  onPin: (st: string | null) => void;
}) {
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [q, setQ] = useState("");

  const items = useMemo<Item[]>(
    () =>
      [...entries.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((e) =>
          e.measures.map((m) => {
            const p = measureParts(m, e.name);
            const desc = measureDescription(m);
            return { meta: m, st: e.st, stateName: e.name, ...p, desc, topics: measureTopics(m), haystack: `${e.name} ${m.name} ${desc ?? ""}`.toLowerCase() };
          }),
        ),
    [entries],
  );

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matchesQuery = (it: Item) => (topic === "all" || it.topics.includes(topic)) && terms.every((t) => it.haystack.includes(t));
  const matching = items.filter(matchesQuery);
  const shown = pinned ? matching.filter((it) => it.st === pinned) : matching;

  const perState = new Map<string, number>();
  for (const it of matching) perState.set(it.st, (perState.get(it.st) ?? 0) + 1);
  const topicCounts = new Map<TopicId, number>();
  for (const it of items) for (const t of it.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);

  const groups: { st: string; name: string; list: Item[] }[] = [];
  for (const it of shown) {
    const g = groups[groups.length - 1];
    if (g?.st === it.st) g.list.push(it);
    else groups.push({ st: it.st, name: it.stateName, list: [it] });
  }

  const stateCount = new Set(items.map((i) => i.st)).size;
  const busiest = [...entries.values()].sort((a, b) => b.measures.length - a.measures.length);
  const liveCount = items.filter((i) => live.has(i.meta.id)).length;
  const focus = active ?? pinned;
  const focusEntry = focus ? entries.get(focus) : undefined;

  const look = (st: string, name: string): TileLook => {
    const n = perState.get(st) ?? 0;
    if (!n) return { fill: null, empty: true, label: `${name}: no matching measures` };
    const f = countFill(n);
    return {
      fill: <span className="absolute inset-0" style={{ background: f.background }} />,
      inkOnFill: f.ink,
      sub: String(n),
      label: `${name}: ${n} measure${n === 1 ? "" : "s"}`,
    };
  };

  return (
    <div className="space-y-10">
      <section aria-label="Measures at a glance" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        <BigStat value={items.length} label="Statewide measures" />
        <BigStat value={stateCount} label="States voting on them" />
        <BigStat value={busiest[0]?.measures.length ?? 0} label={`Most in one state: ${busiest.filter((e) => e.measures.length === busiest[0]?.measures.length).map((e) => e.name).join(" and ")}`} />
        <BigStat value={liveCount} label={liveCount ? "With a live Yes/No count" : "Live counts start at poll close"} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2 xl:gap-10">
        <section aria-labelledby="m-list" className="min-w-0 space-y-6 lg:order-1">
          <div className="space-y-4">
            <h2 id="m-list" className="section-title">
              Find a measure
            </h2>
            <label className="relative block">
              <span className="sr-only">Search measures</span>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by word or state: abortion, voter ID, Ohio…"
                className="h-14 w-full rounded-lg border border-border-strong bg-s1 pl-12 pr-4 text-[17px] text-foreground outline-none transition-colors placeholder:text-ink-faint focus-visible:border-signal focus-visible:ring-[3px] focus-visible:ring-signal/30"
              />
            </label>
            <FilterChips
              label="Filter by topic"
              value={topic}
              onChange={setTopic}
              options={[{ id: "all" as const, label: "All topics", count: items.length }, ...TOPICS.map((t) => ({ id: t.id, label: t.label, count: topicCounts.get(t.id) ?? 0 }))]}
            />
          </div>

          <div className="flex min-h-10 flex-wrap items-center gap-3 text-[15px] text-ink-muted" aria-live="polite">
            <span>
              <span className="font-semibold text-foreground tnum">{shown.length}</span> measure{shown.length === 1 ? "" : "s"}
              {pinned ? ` in ${entries.get(pinned)?.name ?? pinned}` : ` in ${new Set(shown.map((s) => s.st)).size} states`}
            </span>
            {pinned && (
              <button
                type="button"
                onClick={() => onPin(null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-signal px-3.5 text-sm font-semibold text-ground outline-none hover:opacity-85 focus-visible:ring-[3px] focus-visible:ring-ink"
              >
                <PinIcon className="size-3.5" /> {entries.get(pinned)?.name} <XIcon className="size-3.5" />
              </button>
            )}
            {(topic !== "all" || q) && (
              <button
                type="button"
                onClick={() => {
                  setTopic("all");
                  setQ("");
                }}
                className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-signal"
              >
                Clear filters
              </button>
            )}
          </div>

          {groups.length ? (
            <div className="space-y-10">
              {groups.map((g) => (
                <StateGroup key={g.st} group={g} entry={entries.get(g.st)} live={live} highlighted={focus === g.st} onPreview={onPreview} onTopic={setTopic} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-s2 px-6 py-10 text-center">
              <p className="text-lg font-semibold">No measures match.</p>
              <p className="mt-1 text-[15px] text-ink-muted">Try another word, or clear the topic and state filters.</p>
            </div>
          )}
        </section>

        <aside className="order-first lg:sticky lg:top-36 lg:order-2 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto xl:top-28 xl:max-h-[calc(100vh-8rem)]">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Where the measures are</h2>
                <p className="text-sm text-ink-muted">
                  Counts follow your search and topic. <span className="hidden lg:inline">Click</span>
                  <span className="lg:hidden">Tap</span> a state to list only its measures.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink-muted" aria-hidden>
                {[...BINS].reverse().map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1">
                    <span className="inline-block size-3.5 rounded-[3px]" style={{ background: countFill(b.min).background }} />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <StateTileMap
              look={look}
              active={active}
              pinned={pinned}
              onPreview={onPreview}
              onPin={(st) => perState.has(st) && onPin(pinned === st ? null : st)}
              label="Ballot measures by state"
            />
            {focusEntry && focusEntry.measures.length > 0 ? (
              <div className="space-y-3 rounded-md bg-s3/60 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="display text-2xl font-extrabold">{focusEntry.name}</h3>
                  <span className="text-[15px] text-ink-muted tnum">
                    {focusEntry.measures.length} measure{focusEntry.measures.length === 1 ? "" : "s"}
                    {focusEntry.meta ? ` · polls close ${fmtEt(focusEntry.meta.pollCloseEt)}` : ""}
                  </span>
                </div>
                <TopicBreakdown measures={focusEntry.measures} />
              </div>
            ) : (
              <div className="hidden space-y-3 rounded-md bg-s3/60 p-4 lg:block">
                <h3 className="text-lg font-semibold">{matching.length === items.length ? "Most common topics" : "Topics in these results"}</h3>
                <TopicBreakdown measures={matching.map((i) => i.meta)} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TopicBreakdown({ measures }: { measures: RaceMeta[] }) {
  const counts = new Map<TopicId, number>();
  for (const m of measures) for (const t of measureTopics(m)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = rows[0]?.[1] ?? 1;
  return (
    <ul className="space-y-2">
      {rows.map(([t, n]) => (
        <li key={t} className="grid grid-cols-[9.5rem_minmax(0,1fr)_1.5rem] items-center gap-3 text-sm">
          <span className="truncate text-ink-muted">{TOPICS.find((x) => x.id === t)?.label}</span>
          <span className="h-2 rounded-full bg-ink-muted" style={{ width: `${(n / top) * 100}%` }} />
          <span className="text-right font-semibold tnum">{n}</span>
        </li>
      ))}
    </ul>
  );
}

function StateGroup({
  group,
  entry,
  live,
  highlighted,
  onPreview,
  onTopic,
}: {
  group: { st: string; name: string; list: Item[] };
  entry?: StateEntry;
  live: Map<string, LiveRace>;
  highlighted: boolean;
  onPreview: (st: string | null) => void;
  onTopic: (t: TopicId) => void;
}) {
  return (
    <section aria-label={`${group.name} measures`} onMouseEnter={() => onPreview(group.st)} onMouseLeave={() => onPreview(null)} className="space-y-3">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 pb-3 transition-colors" style={{ borderColor: highlighted ? "var(--signal)" : "var(--border-strong)" }}>
        <h3 className="display text-2xl font-extrabold">{group.name}</h3>
        <span className="text-[15px] text-ink-muted tnum">
          {group.list.length} measure{group.list.length === 1 ? "" : "s"}
          {entry?.meta ? ` · polls close ${fmtEt(entry.meta.pollCloseEt)}` : ""}
        </span>
        <a
          href={ballotpediaUrl(group.name)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-muted underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-signal"
        >
          Full text on Ballotpedia <ExternalLinkIcon className="size-3.5" />
        </a>
      </header>
      <ul className="space-y-2">
        {group.list.map((it) => (
          <MeasureRow key={it.meta.id} item={it} live={live.get(it.meta.id)} onTopic={onTopic} />
        ))}
      </ul>
    </section>
  );
}

function MeasureRow({ item, live, onTopic }: { item: Item; live?: LiveRace; onTopic: (t: TopicId) => void }) {
  const [open, setOpen] = useState(false);
  const yn = yesNo(live);
  const long = (item.desc?.length ?? 0) > 150;
  return (
    <li className="rounded-lg bg-s2 p-5 transition-colors hover:bg-s3">
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {item.tag && <span className="rounded-[3px] border border-border-strong px-2 py-0.5 font-semibold text-foreground">{item.tag}</span>}
          {item.kind && <span className="font-medium text-ink-muted">{item.kind}</span>}
          
        </div>
        <h4 className="text-lg font-semibold leading-snug text-pretty">
          <Link href={raceHref(item.meta.id)} className="underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-signal">
            {item.title}
          </Link>
        </h4>
        {yn && <YesNoBar yn={yn} live={live!} />}
        {item.desc && item.desc !== item.meta.name && (
          <div>
            <p className={cn("text-[15px] leading-relaxed text-ink-muted", !open && "line-clamp-2")}>{item.desc}</p>
            {long && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="mt-1 rounded-sm text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-signal"
              >
                {open ? "Show less" : "Read the summary"}
              </button>
            )}
          </div>
        )}
        {item.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.topics.slice(0, 3).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTopic(t)}
                className="rounded-full bg-s4 px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors outline-none hover:bg-ink hover:text-ground focus-visible:ring-[3px] focus-visible:ring-signal"
              >
                {TOPICS.find((x) => x.id === t)?.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function YesNoBar({ yn, live }: { yn: NonNullable<ReturnType<typeof yesNo>>; live: LiveRace }) {
  const y = yn.yes ?? 0;
  const n = yn.no ?? 0;
  const any = y + n > 0;
  const p = live.pctExpected;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold", y >= n && any ? "text-foreground" : "text-ink-muted")}>
          Yes <span className="fig">{any ? `${y.toFixed(1)}%` : "—"}</span>
        </span>
        <span className={cn("font-semibold", n > y ? "text-foreground" : "text-ink-muted")}>
          <span className="fig">{any ? `${n.toFixed(1)}%` : "—"}</span> No
        </span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {any ? (
          <>
            <span className="h-full bg-signal anim-bar" style={{ width: `${y}%` }} />
            <span className="h-full bg-ink-faint anim-bar" style={{ width: `${n}%` }} />
          </>
        ) : (
          <span className="hatch-sm h-full w-full" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <StatusBadge status={live.status} />
        {p != null && <span className="tnum">{Math.round(p <= 1 ? p * 100 : p)}% in</span>}
      </div>
    </div>
  );
}
