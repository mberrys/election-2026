"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swatch } from "@/components/board/hatch";
import { sortRows, type HistoryRowModel, type SortKey } from "@/analytics/history";
import { cn } from "@/lib/utils";
import { HistoryStrips } from "./history-strips";

export type Level = "states" | "districts";

export interface HistoryBoardProps {
  nation: HistoryRowModel;
  /** Keyed "<level>:<yardstick>", e.g. "states:senate", "districts:house". */
  rowsets: Record<string, HistoryRowModel[]>;
  asOf?: string;
}

const LEVELS: Array<{ id: Level; label: string }> = [
  { id: "states", label: "States" },
  { id: "districts", label: "House districts" },
];

const YARDSTICKS: Record<Level, Array<{ id: string; label: string }>> = {
  states: [
    { id: "pres", label: "President" },
    { id: "senate", label: "Senate" },
    { id: "governor", label: "Governor" },
  ],
  districts: [
    { id: "house", label: "House" },
    { id: "pres", label: "President (2026 lines)" },
  ],
};

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "projected", label: "Projected margin" },
  { value: "lastTime", label: "Longest since" },
  { value: "change", label: "Change vs latest" },
  { value: "name", label: "Name" },
];

/** The reference list: every state or district, its margins since 1976, the 2026 projection and the last time it voted that way. */
export function HistoryBoard({ nation, rowsets, asOf }: HistoryBoardProps) {
  const [level, setLevel] = useState<Level>("states");
  const [yardstick, setYardstick] = useState<Record<Level, string>>({ states: "pres", districts: "house" });
  const [sort, setSort] = useState<SortKey>("projected");
  const [query, setQuery] = useState("");

  const ys = yardstick[level];
  const base = useMemo(() => rowsets[`${level}:${ys}`] ?? [], [rowsets, level, ys]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? base.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : base;
    return sortRows(filtered, sort);
  }, [base, query, sort]);

  return (
    <section aria-labelledby="every-place" className="space-y-5">
      <div className="space-y-1.5">
        <h2 id="every-place" className="section-title">
          Every {level === "states" ? "state" : "district"}, every election
        </h2>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-muted">
          One strip per place, oldest election on the left. The outlined cell is 2026, from polls. The last column names the most recent election at
          least as far toward the side the polls point.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Chips label="Places" options={LEVELS} value={level} onChange={setLevel} />
        <Chips label="Compare against" options={YARDSTICKS[level]} value={ys} onChange={(v) => setYardstick((cur) => ({ ...cur, [level]: v }))} />
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Select value={sort} onValueChange={(v) => setSort((v as SortKey | null) ?? "projected")} items={SORTS}>
            <SelectTrigger size="sm" className="h-9 min-w-40 text-[13px]" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={level === "states" ? "Find a state" : "Find a district, e.g. TX-15"}
            aria-label="Search"
            className="h-9 min-w-0 flex-1 text-[13px] sm:w-52 sm:flex-none"
          />
        </div>
      </div>

      <HistoryStrips rows={rows} pinned={level === "states" ? nation : undefined} unitLabel={level === "states" ? "State" : "District"} />

      <Legend level={level} yardstick={ys} asOf={asOf} />
    </section>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-9 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-signal",
              on ? "bg-s4 text-ink ring-1 ring-border-strong" : "text-ink-muted hover:bg-s3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Legend({ level, yardstick, asOf }: { level: Level; yardstick: string; asOf?: string }) {
  const t = asOf ? Date.parse(asOf) : NaN;
  return (
    <div className="space-y-2 text-[13px] leading-snug text-ink-muted">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-[3px]" aria-hidden>
          {([3, 2, 1] as const).map((n) => (
            <Swatch key={`d${n}`} kind={`ramp-d-${n}`} className="h-3.5 w-4" />
          ))}
          {([1, 2, 3] as const).map((n) => (
            <Swatch key={`r${n}`} kind={`ramp-r-${n}`} className="h-3.5 w-4" />
          ))}
        </span>
        <span>Margin, D or R: under 2, 2 to 5, and 5+ points</span>
      </div>
      {level === "districts" && yardstick === "house" && (
        <p>* Districts redrawn for 2024 or 2026: House results only compare within a map era (2022 onward). Past maps are not carried back.</p>
      )}
      <p>
        2026 uses each race&apos;s poll average{Number.isNaN(t) ? "" : ` (national generic ballot as of ${dayFmt.format(t)})`}, as published. States without a Senate or governor poll are
        projected from their last presidential margin plus the national swing since 2024.
      </p>
    </div>
  );
}
