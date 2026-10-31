"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Swatch } from "@/components/board/hatch";
import { sortRows, type HistoryRowModel, type SortKey } from "@/analytics/history";
import type { TrendPoint } from "@/data/reference/load";
import { HistoryDetail } from "./history-detail";
import { lastTimeSentence } from "./summary";
import { HistoryStrips } from "./history-strips";

export type Level = "states" | "districts";

export interface HistoryBoardProps {
  nation: HistoryRowModel;
  /** Keyed "<level>:<yardstick>", e.g. "states:senate", "districts:house". */
  rowsets: Record<string, HistoryRowModel[]>;
  trend: Record<string, TrendPoint[]>;
  asOf?: string;
}

const YARDSTICKS: Record<Level, Array<{ value: string; label: string }>> = {
  states: [
    { value: "pres", label: "President" },
    { value: "senate", label: "Senate" },
    { value: "governor", label: "Governor" },
  ],
  districts: [
    { value: "house", label: "House" },
    { value: "pres", label: "President (2026 lines)" },
  ],
};

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "projected", label: "Projected margin" },
  { value: "lastTime", label: "Longest since" },
  { value: "change", label: "Change vs latest" },
  { value: "name", label: "Name" },
];

export function HistoryBoard({ nation, rowsets, trend, asOf }: HistoryBoardProps) {
  const [level, setLevel] = useState<Level>("states");
  const [yardstick, setYardstick] = useState<Record<Level, string>>({ states: "pres", districts: "house" });
  const [sort, setSort] = useState<SortKey>("projected");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("US");

  const ys = yardstick[level];
  const base = useMemo(() => rowsets[`${level}:${ys}`] ?? [], [rowsets, level, ys]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? base.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : base;
    return sortRows(filtered, sort);
  }, [base, query, sort]);

  const selected = selectedId === "US" ? nation : (base.find((r) => r.id === selectedId) ?? nation);
  const selectedTrend = selected.kind === "nation" ? trend.generic : selected.projection?.poll ? trend[selected.projection.poll.raceId] : undefined;
  const selectedYardstick = selected.kind === "nation" ? "pres" : ys;

  const setLevelAndReset = (l: Level) => {
    setLevel(l);
    setSelectedId("US");
  };

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardContent className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nationally</div>
          <p className="display text-lg font-bold leading-snug md:text-xl">{lastTimeSentence(nation, "pres")}</p>
          <p className="text-xs text-muted-foreground">
            Generic-ballot average{asOf ? ` as of ${asOf}` : ""}, compared with the presidential popular vote since 1976. Polls are shown as published.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup value={[level]} onValueChange={(v) => v[0] && setLevelAndReset(v[0] as Level)} variant="outline" size="sm" spacing={0} aria-label="Level">
          <ToggleGroupItem value="states">States</ToggleGroupItem>
          <ToggleGroupItem value="districts">House districts</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          value={[ys]}
          onValueChange={(v) => v[0] && setYardstick((cur) => ({ ...cur, [level]: v[0] }))}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Compare against"
        >
          {YARDSTICKS[level].map((y) => (
            <ToggleGroupItem key={y.value} value={y.value}>
              {y.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort((v as SortKey | null) ?? "projected")} items={SORTS}>
            <SelectTrigger size="sm" className="min-w-40" aria-label="Sort by">
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
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={level === "states" ? "Find a state" : "Find a district, e.g. TX-15"} aria-label="Search" className="h-7 w-48" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-2">
          <HistoryStrips
            rows={rows}
            pinned={level === "states" ? nation : undefined}
            selectedId={selected.id}
            onSelect={setSelectedId}
            unitLabel={level === "states" ? "State" : "District"}
          />
          <Legend level={level} yardstick={ys} />
        </div>
        <Card size="sm" className="h-fit xl:sticky xl:top-20">
          <CardContent>
            <HistoryDetail key={`${level}:${ys}:${selected.id}`} row={selected} yardstick={selectedYardstick} trend={selectedTrend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Legend({ level, yardstick }: { level: Level; yardstick: string }) {
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <Swatch key={`d${n}`} kind={`ramp-d-${n}`} className="h-3 w-3.5 rounded-none" />
          ))}
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <Swatch key={`r${n}`} kind={`ramp-r-${n}`} className="h-3 w-3.5 rounded-none" />
          ))}
          <span className="ml-1">Margin: under 2, 5, 10, 20, 20+ pts</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Swatch kind="lean-d" /> <Swatch kind="lean-r" /> Projected from polls (hatched)
        </span>
        <span className="inline-flex items-center gap-1">
          <i aria-hidden className="inline-block h-3 w-3 rounded-[1px] outline outline-2 -outline-offset-1 outline-foreground" /> Last election at least this D or R
        </span>
      </div>
      {level === "districts" && yardstick === "house" && (
        <p>* Districts redrawn for 2024 or 2026: House results are only comparable within a map era (2022 onward). Past maps are not carried back.</p>
      )}
      <p>
        States without a Senate or governor poll are projected from their last presidential margin plus the national swing since 2024.
      </p>
    </div>
  );
}
