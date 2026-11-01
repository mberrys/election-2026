"use client";

import type { Race, RaceMeta } from "@/data/schema";
import { RatingBadge } from "@/components/board/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { groupRaces, raceTabLabel } from "./derive";

type LiveIndex = ReadonlyMap<string, Race>;

/** House districts beyond this count go in a dropdown; the district cards further down list them all. */
const HOUSE_BUTTON_LIMIT = 4;

/**
 * Race picker: statewide races first as buttons (race name in bold, rating as coloured text), then House districts
 * (buttons for small delegations, a dropdown for large ones), then ballot measures.
 */
export function RaceSelector({
  metas,
  live,
  value,
  onChange,
}: {
  metas: RaceMeta[];
  live: LiveIndex;
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const g = groupRaces(metas);
  const statewide = [...g.senate, ...g.governor];
  if (!statewide.length && !g.house.length && !g.ballot.length)
    return <p className="text-[15px] text-muted-foreground">No federal or statewide races on this state&apos;s ballot.</p>;

  const houseAsButtons = g.house.length <= HOUSE_BUTTON_LIMIT;
  const houseSelected = g.house.some((m) => m.id === value);
  const houseItems = g.house.map((m) => ({ value: m.id, label: `${raceTabLabel(m)}${m.ratings.consensus ? ` · ${ratingLabel[m.ratings.consensus]}` : ""}` }));

  return (
    <nav aria-label="Choose a race" className="space-y-3">
      <div className="flex flex-wrap items-stretch gap-2">
        {statewide.map((m) => (
          <RaceButton key={m.id} meta={m} race={live.get(m.id)} pressed={m.id === value} onClick={() => onChange(m.id)} />
        ))}
        {houseAsButtons &&
          g.house.map((m) => <RaceButton key={m.id} meta={m} race={live.get(m.id)} pressed={m.id === value} onClick={() => onChange(m.id)} />)}
        {!houseAsButtons && (
          <Select value={houseSelected ? value : null} onValueChange={(v) => v && onChange(String(v))} items={houseItems}>
            <SelectTrigger
              aria-label="House district"
              className={cn("h-auto min-h-12 w-full rounded-lg px-3.5 text-[15px] sm:w-64", houseSelected && "border-signal")}
            >
              <SelectValue placeholder={`House districts (${g.house.length})`} />
            </SelectTrigger>
            <SelectContent>
              {g.house.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-semibold tnum">{raceTabLabel(m)}</span>
                  <Outlook meta={m} race={live.get(m.id)} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {g.ballot.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-2">
          {g.ballot.map((m) => (
            <RaceButton key={m.id} meta={m} race={live.get(m.id)} pressed={m.id === value} onClick={() => onChange(m.id)} />
          ))}
        </div>
      )}
    </nav>
  );
}

function RaceButton({ meta, race, pressed, onClick }: { meta: RaceMeta; race?: Race; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={meta.office === "ballot" ? meta.name : undefined}
      className={cn(
        "flex min-h-12 flex-col items-start justify-center rounded-lg border border-border px-3.5 py-1.5 text-left transition-colors hover:bg-s3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        meta.office === "ballot" && "max-w-[18rem]",
        pressed && "border-signal bg-s2",
      )}
    >
      <span className="max-w-full truncate text-[15px] font-semibold leading-tight tnum">{raceTabLabel(meta)}</span>
      <Outlook meta={meta} race={race} />
    </button>
  );
}

/** Projected party once called, else the consensus rating as coloured text. Nothing for unrated races and measures. */
function Outlook({ meta, race }: { meta: RaceMeta; race?: Race }) {
  const win = race?.projection;
  if (win)
    return (
      <span className={cn("text-xs font-medium", win.party === "D" ? "text-party-d-ink" : win.party === "R" ? "text-party-r-ink" : "text-foreground")}>
        Projected {win.party}
      </span>
    );
  if (!meta.ratings.consensus || meta.office === "ballot") return null;
  return <RatingBadge rating={meta.ratings.consensus} />;
}
