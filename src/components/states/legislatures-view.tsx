"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { raceHref } from "@/lib/race-slug";
import { ArrowRightIcon, PinIcon, XIcon } from "lucide-react";
import type { RatingCode } from "@/data/schema";
import { RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { Pct } from "@/components/board/num";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtEt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StateTileMap, type TileLook } from "./state-tile-map";
import { BigStat, FilterChips, SeatBar } from "./seat-bar";
import { controlFill, measureParts, type Chamber, type StateEntry } from "./states-lib";

type MapMode = "control" | "forecast";
type Filter = "all" | "play" | "narrow" | "D" | "R" | "split";

const chambersOf = (e: StateEntry) => [e.uni, e.upper, e.lower].filter((c): c is Chamber => !!c);

function matches(c: Chamber, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "play":
      return c.inPlay;
    case "narrow":
      return !!c.split && (c.split.spare == null || c.split.spare <= 2);
    case "D":
      return c.control.party === "D";
    case "R":
      return c.control.party === "R";
    case "split":
      return c.control.party == null;
  }
}

const RAMP_STEP = { solid: 4, likely: 3, lean: 2, tilt: 1 } as const;

/** Forecast fill: the margin ramp by rating strength; toss-ups stay hatched (nothing known yet). */
function ratingLook(r: RatingCode | undefined): { className?: string; background?: string } {
  if (!r) return { background: "var(--s3)" };
  if (r === "tossup") return { className: "hatch-strong" };
  const [strength, side] = r.split("-") as [keyof typeof RAMP_STEP, "d" | "r"];
  return { background: `var(--ramp-${side}-${RAMP_STEP[strength]})` };
}

const RATING_ORDER: Record<RatingCode, number> = { tossup: 0, "tilt-d": 1, "tilt-r": 1, "lean-d": 2, "lean-r": 2, "likely-d": 3, "likely-r": 3, "solid-d": 4, "solid-r": 4 };

/** "R 77–28", "Coalition 21–19", "Tied 67–67"; Nebraska's nonpartisan note shortened. */
export function seatsText(c: Chamber): string {
  const s = c.split;
  if (!s) return c.meta.heldBy === "R" ? "Nonpartisan, R-endorsed majority" : "Nonpartisan";
  const nums = s.segments.map((x) => x.n).join("–");
  if (s.lead) return `${s.lead} ${nums}`;
  return s.segments[0].key === "coalition" ? `Coalition ${nums}` : `Tied ${nums}`;
}

function seatsColor(c: Chamber): string {
  const p = c.split?.lead ?? (c.control.party === "D" || c.control.party === "R" ? c.control.party : null);
  return p === "D" ? "var(--party-d-ink)" : p === "R" ? "var(--party-r-ink)" : "var(--ink)";
}

export function LegislaturesView({
  entries,
  active,
  pinned,
  onPreview,
  onPin,
  onShowMeasures,
}: {
  entries: Map<string, StateEntry>;
  active: string | null;
  pinned: string | null;
  onPreview: (st: string | null) => void;
  onPin: (st: string | null) => void;
  onShowMeasures: (st: string) => void;
}) {
  const [mode, setMode] = useState<MapMode>("control");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => [...entries.values()].filter((e) => chambersOf(e).length).sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  const all = useMemo(() => rows.flatMap(chambersOf), [rows]);
  const count = (f: Filter) => all.filter((c) => matches(c, f)).length;
  const counts = { D: count("D"), R: count("R"), split: count("split"), play: count("play"), narrow: count("narrow") };
  const visible = filter === "all" ? rows : rows.filter((e) => chambersOf(e).some((c) => matches(c, filter)));
  const visibleSet = new Set(visible.map((e) => e.st));

  const focus = active ?? pinned;
  const focusEntry = focus ? entries.get(focus) : undefined;
  const pinnedEntry = pinned ? entries.get(pinned) : undefined;

  const look = (st: string, name: string): TileLook => {
    const e = entries.get(st);
    const up = e?.uni ?? e?.upper;
    const low = e?.uni ?? e?.lower;
    if (!e || (!up && !low)) return { fill: null, empty: true, label: `${name}: no legislative chambers on the 2026 ballot` };
    const half = (c: Chamber | undefined, pos: "top" | "bottom") => {
      const l = mode === "forecast" ? ratingLook(c?.rating) : { background: c ? controlFill(c.control) : "var(--s3)" };
      return <span className={cn("absolute inset-x-0 h-1/2", pos === "top" ? "top-0" : "bottom-0", l.className)} style={{ background: l.background }} />;
    };
    const parts = chambersOf(e).map((c) => `${c.name} ${seatsText(c)}${c.rating ? `, ${c.rating.replace("-", " ")}` : ""}`);
    return {
      fill: (
        <>
          {half(up, "top")}
          {half(low, "bottom")}
          {!e.uni && <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-black/40" />}
        </>
      ),
      label: `${name}: ${parts.join("; ")}${e.governor ? "; governor race" : ""}`,
    };
  };

  return (
    <div className="space-y-10">
      <ChamberTally all={all} counts={counts} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="leg-map" className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <h2 id="leg-map" className="section-title">
                  {mode === "control" ? "Who controls each chamber" : "Who is favored to control it"}
                </h2>
                <p className="text-[15px] text-muted-foreground">The top half of each tile is the Senate. The bottom half is the House.</p>
              </div>
              <FilterChips
                label="Map coloring"
                value={mode}
                onChange={setMode}
                options={[
                  { id: "control", label: "Control going in" },
                  { id: "forecast", label: "Forecast" },
                ]}
              />
            </div>
            <StateTileMap
              look={look}
              active={active}
              pinned={pinned}
              muted={(st) => filter !== "all" && !visibleSet.has(st)}
              onPreview={onPreview}
              onPin={(st) => onPin(pinned === st ? null : st)}
              label="State legislatures on the 2026 ballot"
            />
            <MapLegend mode={mode} projected={all.some((c) => c.control.called)} />
            {/* Phones have no hover and no side column: the pinned state opens right under the map. */}
            {pinnedEntry && (
              <div className="lg:hidden">
                <StatePanel entry={pinnedEntry} pinned onUnpin={() => onPin(null)} onShowMeasures={onShowMeasures} />
              </div>
            )}
          </section>

          <div className="lg:hidden">
            <InPlayPanel chambers={all} entries={entries} onPreview={onPreview} onPin={onPin} />
          </div>

          <section aria-labelledby="leg-table" className="space-y-5">
            <div className="space-y-4">
              <h2 id="leg-table" className="section-title">
                Every chamber on the ballot
              </h2>
              <FilterChips
                label="Filter chambers"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: "all", label: "All", count: all.length },
                  { id: "play", label: "In play", count: counts.play },
                  { id: "narrow", label: "Two seats or fewer to spare", count: counts.narrow },
                  { id: "D", label: "Democratic", count: counts.D },
                  { id: "R", label: "Republican", count: counts.R },
                  { id: "split", label: "Coalition or tied", count: counts.split },
                ]}
              />
            </div>
            <ChamberTable rows={visible} filter={filter} focus={focus} pinned={pinned} onPreview={onPreview} onPin={onPin} />
          </section>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] xl:top-28 xl:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          {focusEntry ? (
            <StatePanel entry={focusEntry} pinned={pinned === focusEntry.st} onUnpin={() => onPin(null)} onShowMeasures={onShowMeasures} />
          ) : (
            <InPlayPanel chambers={all} entries={entries} onPreview={onPreview} onPin={onPin} />
          )}
        </aside>
      </div>
    </div>
  );
}

function ChamberTally({ all, counts }: { all: Chamber[]; counts: { D: number; R: number; split: number; play: number } }) {
  const order = (c: Chamber) => (c.control.party === "D" ? 0 : c.control.party == null ? 1 : 2);
  const cells = [...all].sort((a, b) => order(a) - order(b) || Number(b.inPlay) - Number(a.inPlay));
  return (
    <section aria-label="Chamber control at a glance" className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        <BigStat value={counts.D} label="Democratic chambers" color="var(--party-d-ink)" />
        <BigStat value={counts.R} label="Republican chambers" color="var(--party-r-ink)" />
        <BigStat value={counts.split} label="Coalition or tied" />
        <BigStat value={counts.play} label="In play by forecast" />
      </div>
      <div className="space-y-2">
        <div className="flex h-7 gap-px sm:gap-[3px]" role="img" aria-label={`${all.length} chambers: ${counts.D} Democratic, ${counts.split} coalition or tied, ${counts.R} Republican; ${counts.play} in play`}>
          {cells.map((c) => {
            return (
              <span
                key={c.meta.id}
                className={cn("min-w-0 flex-1 rounded-[2px]", c.inPlay && "opacity-45")}
                style={{ background: controlFill({ ...c.control, called: true }) }}
                title={`${c.meta.state} ${c.name}: ${seatsText(c)}`}
              />
            );
          })}
        </div>
        <p className="text-sm text-ink-muted">
          One block per chamber, {all.length} in all. Faded blocks are rated <Link href="/explainers#ratings" className="text-foreground underline underline-offset-4">toss-up, tilt or lean</Link>.
        </p>
      </div>
    </section>
  );
}

function MapLegend({ mode, projected }: { mode: MapMode; projected: boolean }) {
  const sw = (style: React.CSSProperties, cls?: string) => <span className={cn("inline-block size-4 shrink-0 rounded-[3px]", cls)} style={style} />;
  const items: [React.ReactNode, string][] =
    mode === "control"
      ? [
          [sw({ background: "var(--ramp-d-3)" }), "Democratic"],
          [sw({ background: "var(--ramp-r-3)" }), "Republican"],
          [sw({ background: controlFill({ party: null, called: false, label: "" }) }), "Coalition or tied"],
          ...(projected
            ? ([
                [sw({ background: "var(--party-d)" }), "Projected D"],
                [sw({ background: "var(--party-r)" }), "Projected R"],
              ] as [React.ReactNode, string][])
            : []),
        ]
      : [
          [sw({ background: "var(--ramp-d-4)" }), "Solid D"],
          [sw({ background: "var(--ramp-d-2)" }), "Lean D"],
          [sw({}, "hatch-strong"), "Toss-up"],
          [sw({ background: "var(--ramp-r-2)" }), "Lean R"],
          [sw({ background: "var(--ramp-r-4)" }), "Solid R"],
        ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
      {items.map(([s, l]) => (
        <span key={l} className="inline-flex items-center gap-2">
          {s}
          {l}
        </span>
      ))}
      <span className="inline-flex items-center gap-2">
        <span className="inline-block size-4 rounded-[3px] bg-s1 ring-1 ring-inset ring-hairline" />
        No chambers up
      </span>
    </div>
  );
}

function ChamberCell({ c }: { c: Chamber }) {
  const counting = c.live && c.live.status !== "not_started";
  const p = c.live?.pctExpected;
  return (
    <div className="flex items-center gap-4 md:min-w-[15rem]">
      <div className="w-32 shrink-0">
        <div className="text-[15px] font-semibold tnum" style={{ color: seatsColor(c) }}>
          {seatsText(c)}
        </div>
        {c.split && <SeatBar split={c.split} className="mt-2 h-1.5" />}
      </div>
      {counting ? (
        <div className="flex items-center gap-2">
          <StatusBadge status={c.live!.status} party={c.live!.projection?.party} />
          {p != null && <Pct value={p <= 1 ? p * 100 : p} digits={0} className="text-sm text-ink-muted" />}
        </div>
      ) : (
        <RatingBadge rating={c.rating} className="text-sm" />
      )}
    </div>
  );
}

function ChamberTable({
  rows,
  filter,
  focus,
  pinned,
  onPreview,
  onPin,
}: {
  rows: StateEntry[];
  filter: Filter;
  focus: string | null;
  pinned: string | null;
  onPreview: (st: string | null) => void;
  onPin: (st: string | null) => void;
}) {
  if (!rows.length) return <p className="rounded-md bg-s2 px-5 py-8 text-[15px] text-ink-muted">No chambers match this filter.</p>;
  const cell = (c: Chamber | undefined) =>
    c ? (
      <div className={cn(filter !== "all" && !matches(c, filter) && "opacity-40")}>
        <ChamberCell c={c} />
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">Not up in 2026</span>
    );
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {rows.map((e) => (
          <li key={e.st}>
            <button
              type="button"
              aria-pressed={pinned === e.st}
              onClick={() => {
                onPin(pinned === e.st ? null : e.st);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                "w-full space-y-3 rounded-lg bg-s2 p-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-signal",
                pinned === e.st && "ring-2 ring-signal",
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{e.name}</span>
                {e.measures.length > 0 && (
                  <span className="text-sm text-ink-muted tnum">
                    {e.measures.length} measure{e.measures.length === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              {chambersOf(e).map((c) => (
                <span key={c.meta.id} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-ink-muted">{c.name}</span>
                  <ChamberCell c={c} />
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden rounded-lg bg-card md:block">
        <Table className="text-[15px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">State</TableHead>
              <TableHead>Senate</TableHead>
              <TableHead>House</TableHead>
              <TableHead>Governor</TableHead>
              <TableHead className="pr-5 text-right">Measures</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody onMouseLeave={() => onPreview(null)}>
            {rows.map((e) => {
              const isPinned = pinned === e.st;
              return (
                <TableRow
                  key={e.st}
                  onMouseEnter={() => onPreview(e.st)}
                  onClick={() => onPin(isPinned ? null : e.st)}
                  className={cn("cursor-pointer", focus === e.st && "bg-s3 hover:bg-s3")}
                >
                  <TableCell className="relative py-4 pl-5">
                    {isPinned && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal" />}
                    <button
                      type="button"
                      aria-pressed={isPinned}
                      onFocus={() => onPreview(e.st)}
                      onBlur={() => onPreview(null)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onPin(isPinned ? null : e.st);
                      }}
                      className="rounded-sm text-base font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-signal"
                    >
                      {e.name}
                    </button>
                  </TableCell>
                  {e.uni ? (
                    <TableCell colSpan={2} className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-ink-muted">Unicameral</span>
                        {cell(e.uni)}
                      </div>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="py-4">{cell(e.upper)}</TableCell>
                      <TableCell className="py-4">{cell(e.lower)}</TableCell>
                    </>
                  )}
                  <TableCell className="py-4">
                    {e.governor ? <RatingBadge rating={e.governor.meta.ratings.consensus} className="text-sm" /> : <span className="text-ink-faint">—</span>}
                  </TableCell>
                  <TableCell className="py-4 pr-5 text-right tnum">{e.measures.length || <span className="text-ink-faint">—</span>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function InPlayPanel({
  chambers,
  entries,
  onPreview,
  onPin,
}: {
  chambers: Chamber[];
  entries: Map<string, StateEntry>;
  onPreview: (st: string | null) => void;
  onPin: (st: string | null) => void;
}) {
  const list = chambers
    .filter((c) => c.inPlay)
    .sort((a, b) => RATING_ORDER[a.rating!] - RATING_ORDER[b.rating!] || (a.split?.spare ?? 0) - (b.split?.spare ?? 0));
  return (
    <div className="rounded-lg bg-card p-6 md:p-7">
      <h2 className="section-title">Where control is in play</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        {list.length} chambers are rated <Link href="/explainers#ratings" className="text-foreground underline underline-offset-4">toss-up, tilt or lean</Link> by <a href="https://centerforpolitics.org/crystalball/" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">Sabato&apos;s Crystal Ball</a>. Pick one to open its state.
      </p>
      <ul className="mt-6 space-y-1.5" onMouseLeave={() => onPreview(null)}>
        {list.map((c) => (
          <li key={c.meta.id}>
            <button
              type="button"
              onMouseEnter={() => onPreview(c.meta.state)}
              onFocus={() => onPreview(c.meta.state)}
              onBlur={() => onPreview(null)}
              onClick={() => onPin(c.meta.state)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md bg-s3/50 px-4 py-3 text-left transition-colors outline-none hover:bg-s4 focus-visible:ring-[3px] focus-visible:ring-signal"
            >
              <span className="truncate text-base font-semibold">
                {entries.get(c.meta.state)?.name} <span className="font-normal text-ink-muted">{c.name}</span>
              </span>
              <RatingBadge rating={c.rating} className="justify-self-end text-sm" />
              <span className="text-sm font-medium tnum" style={{ color: seatsColor(c) }}>
                {seatsText(c)}
              </span>
              <span className="justify-self-end text-sm text-ink-muted tnum">
                {c.split?.spare != null ? (c.split.spare === 0 ? "No seat to spare" : `${c.split.spare} to spare`) : "Tied"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function spareLine(c: Chamber): string {
  const s = c.split!;
  if (s.spare == null) return `Tied. ${s.majority} seats make a majority`;
  const who = s.lead === "D" ? "Democrats" : s.lead === "R" ? "Republicans" : "The coalition";
  if (s.spare === 0) return `${s.majority} for a majority. ${who} can lose no seats and keep control.`;
  return `${s.majority} for a majority. ${who} can lose ${s.spare} seat${s.spare === 1 ? "" : "s"} and keep control.`;
}

function ChamberBlock({ c }: { c: Chamber }) {
  const counting = c.live && c.live.status !== "not_started";
  const p = c.live?.pctExpected;
  const segs = c.split?.segments ?? [];
  return (
    <div className="space-y-3 rounded-md bg-s3/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{c.name}</h3>
        <RatingBadge rating={c.rating} className="text-sm" />
      </div>
      {c.split ? (
        <>
          <div className="flex items-baseline gap-2">
            {segs.map((s, i) => (
              <span key={`${s.key}-${i}`} className="flex items-baseline gap-2">
                {i > 0 && <span className="text-xl text-ink-faint">–</span>}
                <span
                  className={cn("hero-num leading-none", i < 2 ? "text-4xl" : "text-2xl text-ink-muted")}
                  style={i < 2 ? { color: s.key === "D" ? "var(--party-d)" : s.key === "R" ? "var(--party-r)" : s.key === "coalition" ? "var(--party-i)" : "var(--ink-muted)" } : undefined}
                >
                  {s.n}
                </span>
              </span>
            ))}
            <span className="ml-1 text-sm text-ink-muted">{segs.map((s) => s.label).filter((l, i, a) => a.indexOf(l) === i).join(" · ")}</span>
          </div>
          <SeatBar split={c.split} />
          <p className="text-sm leading-relaxed text-ink-muted">{spareLine(c)}</p>
        </>
      ) : (
        <p className="text-[15px] leading-relaxed text-ink-muted">{c.meta.notes?.split(" Embedded")[0]}</p>
      )}
      {counting && (
        <div className="flex items-center gap-3 pt-1">
          <StatusBadge status={c.live!.status} party={c.live!.projection?.party} />
          {p != null && (
            <span className="text-sm text-ink-muted">
              <Pct value={p <= 1 ? p * 100 : p} digits={0} /> of the expected vote in
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatePanel({
  entry,
  pinned,
  onUnpin,
  onShowMeasures,
}: {
  entry: StateEntry;
  pinned: boolean;
  onUnpin: () => void;
  onShowMeasures: (st: string) => void;
}) {
  const chambers = chambersOf(entry);
  const gov = entry.governor;
  return (
    <div className="space-y-5 rounded-lg bg-card p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="display text-[2rem] font-extrabold leading-none">{entry.name}</h2>
          {entry.meta && <p className="text-[15px] text-ink-muted">Polls close {fmtEt(entry.meta.pollCloseEt)}</p>}
        </div>
        {pinned ? (
          <button
            type="button"
            onClick={onUnpin}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-signal px-3.5 text-sm font-semibold text-ground transition-opacity outline-none hover:opacity-85 focus-visible:ring-[3px] focus-visible:ring-ink"
          >
            <PinIcon className="size-3.5" /> Pinned <XIcon className="size-3.5" />
          </button>
        ) : (
          <span className="mt-2 shrink-0 text-sm text-muted-foreground">Click to pin</span>
        )}
      </div>

      {chambers.length ? (
        chambers.map((c) => <ChamberBlock key={c.meta.id} c={c} />)
      ) : (
        <p className="rounded-md bg-s3/60 p-5 text-[15px] text-ink-muted">No legislative chambers on the 2026 ballot.</p>
      )}

      {gov && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-s3/60 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Governor</h3>
            <p className="text-sm text-ink-muted">{gov.meta.heldBy === "D" ? "Democrat" : gov.meta.heldBy === "R" ? "Republican" : "Independent"} holds the seat</p>
          </div>
          {gov.live && gov.live.status !== "not_started" ? (
            <StatusBadge status={gov.live.status} party={gov.live.projection?.party} />
          ) : (
            <RatingBadge rating={gov.meta.ratings.consensus} className="text-sm" />
          )}
        </div>
      )}

      {entry.measures.length > 0 && (
        <div className="space-y-3 rounded-md bg-s3/60 p-5">
          <h3 className="text-lg font-semibold">
            {entry.measures.length} ballot measure{entry.measures.length === 1 ? "" : "s"}
          </h3>
          <ul className="space-y-2 text-[15px] leading-snug">
            {entry.measures.slice(0, 3).map((m) => {
              const p = measureParts(m, entry.name);
              return (
                <li key={m.id} className="flex gap-2">
                  {p.tag && <span className="shrink-0 font-semibold text-foreground">{p.tag}</span>}
                  <Link href={raceHref(m.id)} className="line-clamp-2 underline-offset-4 hover:underline">
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => onShowMeasures(entry.st)}
            className="inline-flex items-center gap-1.5 rounded-sm text-[15px] font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-signal"
          >
            {entry.measures.length > 3 ? `See all ${entry.measures.length}` : "See the measures"} <ArrowRightIcon className="size-4" />
          </button>
        </div>
      )}

      <Link
        href={`/state/${entry.st}`}
        className="flex h-12 items-center justify-center gap-2 rounded-md bg-ink text-[15px] font-semibold text-ground transition-opacity outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-signal"
      >
        Open the {entry.name} board <ArrowRightIcon className="size-4" />
      </Link>
    </div>
  );
}
