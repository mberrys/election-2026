"use client";

import { memo, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import tilesJson from "../../../public/data/geo/state-tiles.json";
import type { StateTile, StateTilesFile } from "@/data/geo/types";
import { rampColor, rampStep } from "@/components/board/hatch";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlashbackPlace } from "./flashback-data";

const TILES = tilesJson as StateTilesFile;

const side = (m: number | null | undefined) => (m == null ? null : m >= 0 ? "D" : "R");

interface MapProps {
  places: Record<string, FlashbackPlace>;
  /** Step being shown, and the one shown before it (for the sweep direction and the flip bounce). */
  step: number;
  prevStep: number;
  /** Increments on every step change; alternates the bounce animation so it can restart. */
  tick: number;
  yearLabel: string;
  active: string | null;
  pinned: string | null;
  onPreview: (st: string | null) => void;
  onPin: (st: string) => void;
  onStep: (delta: number) => void;
  /** Drawn in the empty sea above the lower 48 (rows 1–2, columns 2–10). */
  readout: ReactNode;
}

/**
 * The time machine's map: 50 states + DC on the tile grid, coloured by margin for one election.
 * Tiles are memoised, so hovering only re-renders the two tiles whose state changed.
 */
export function FlashbackMap({ places, step, prevStep, tick, yearLabel, active, pinned, onPreview, onPin, onStep, readout }: MapProps) {
  const forward = step >= prevStep;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      onStep(e.key === "ArrowRight" ? 1 : -1);
    }
  };
  return (
    <div
      className="grid gap-[3px] sm:gap-1.5 xl:gap-2"
      style={{ gridTemplateColumns: `repeat(${TILES.cols}, minmax(0, 1fr))` }}
      role="group"
      aria-label={`Presidential margin by state, ${yearLabel}. Arrow keys change the year.`}
      onPointerLeave={() => onPreview(null)}
      onKeyDown={onKeyDown}
    >
      <div aria-hidden className="pointer-events-none flex min-w-0 flex-col justify-center pl-0.5" style={{ gridColumn: "2 / 11", gridRow: "1 / 3" }}>
        {readout}
      </div>
      {TILES.tiles.map((t) => {
        const p = places[t.state];
        const m = p?.margins[step] ?? null;
        const flipped = step !== prevStep && side(m) !== null && side(m) !== side(p?.margins[prevStep]);
        const col = forward ? t.col : TILES.cols - 1 - t.col;
        return (
          <Tile
            key={t.state}
            tile={t}
            name={p?.name ?? t.name}
            margin={m}
            yearLabel={yearLabel}
            flip={flipped ? (tick % 2 === 0 ? "a" : "b") : null}
            delay={col * 14 + t.row * 6}
            active={active === t.state}
            pinned={pinned === t.state}
            onPreview={onPreview}
            onPin={onPin}
          />
        );
      })}
    </div>
  );
}

const Tile = memo(function Tile({
  tile,
  name,
  margin,
  yearLabel,
  flip,
  delay,
  active,
  pinned,
  onPreview,
  onPin,
}: {
  tile: StateTile;
  name: string;
  margin: number | null;
  yearLabel: string;
  flip: "a" | "b" | null;
  delay: number;
  active: boolean;
  pinned: boolean;
  onPreview: (st: string | null) => void;
  onPin: (st: string) => void;
}) {
  const has = margin !== null;
  const dark = has && rampStep(margin) >= 4;
  return (
    <button
      type="button"
      aria-label={`${name}, ${yearLabel}: ${has ? fmtMarginDR(margin) : "no result"}`}
      aria-pressed={pinned}
      onPointerEnter={(e) => e.pointerType === "mouse" && onPreview(tile.state)}
      onFocus={() => onPreview(tile.state)}
      onBlur={() => onPreview(null)}
      onClick={() => onPin(tile.state)}
      className={cn(
        "fb-tile",
        flip === "a" && "fb-flip-a",
        flip === "b" && "fb-flip-b",
        "relative flex aspect-square items-center justify-center rounded-[3px] outline-none sm:rounded-[4px]",
        "text-[12px] font-extrabold leading-none tracking-tight sm:text-sm xl:text-[15px]",
        "focus-visible:z-20 focus-visible:ring-[3px] focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        has ? (dark ? "text-ground" : "text-ink") : "bg-s1 text-ink-faint ring-1 ring-inset ring-hairline",
        active && "z-10 scale-[1.14] shadow-[0_10px_24px_-6px_rgb(0_0_0/0.75)] ring-2 ring-ink",
        pinned && !active && "z-10 ring-2 ring-ink ring-offset-2 ring-offset-background",
      )}
      style={
        {
          gridColumn: tile.col + 1,
          gridRow: tile.row + 1,
          backgroundColor: has ? rampColor(margin) : undefined,
          "--d": `${delay}ms`,
          fontStretch: "112%",
        } as CSSProperties
      }
    >
      {tile.state}
    </button>
  );
});
