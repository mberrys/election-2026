"use client";

import type { ReactNode } from "react";
import tilesJson from "../../../public/data/geo/state-tiles.json";
import type { StateTilesFile } from "@/data/geo/types";
import { cn } from "@/lib/utils";

const TILES = tilesJson as StateTilesFile;

export type TileLook = {
  /** Background of the tile; a node lets a tile split into halves. */
  fill: ReactNode;
  /** Dark text on light fills. */
  inkOnFill?: "light" | "dark";
  /** No data for this state in the current view: drawn as an outline. */
  empty?: boolean;
  /** Small corner mark (governor race, count). */
  corner?: ReactNode;
  /** Second line under the state code (a count), shown where tiles are large enough. */
  sub?: string;
  label: string;
};

/**
 * Tile map of the 50 states + DC. Each tile is a button: hover or focus previews the state,
 * click pins it. `active` is the previewed or pinned state; `muted` states fade (filtered out).
 */
export function StateTileMap({
  look,
  active,
  pinned,
  muted,
  onPreview,
  onPin,
  label,
  className,
}: {
  look: (st: string, name: string) => TileLook;
  active: string | null;
  pinned: string | null;
  muted?: (st: string) => boolean;
  onPreview: (st: string | null) => void;
  onPin: (st: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-1.5 sm:gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${TILES.cols}, minmax(0, 1fr))` }}
      role="group"
      aria-label={label}
      onPointerLeave={() => onPreview(null)}
    >
      {TILES.tiles.map((t) => {
        const l = look(t.state, t.name);
        const isActive = active === t.state;
        const isPinned = pinned === t.state;
        const faded = (active != null && !isActive && !isPinned) || muted?.(t.state);
        return (
          <button
            key={t.state}
            type="button"
            aria-label={l.label}
            aria-pressed={isPinned}
            onPointerEnter={(e) => e.pointerType === "mouse" && onPreview(t.state)}
            onFocus={() => onPreview(t.state)}
            onBlur={() => onPreview(null)}
            onClick={() => onPin(t.state)}
            className={cn(
              "group/tile relative aspect-square overflow-hidden rounded-[4px] outline-none transition-[transform,opacity,box-shadow] duration-150 ease-out",
              "focus-visible:ring-[3px] focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              l.empty && "bg-s1",
              faded && "opacity-40",
              isActive && "z-10 scale-[1.12] shadow-[0_10px_28px_-6px_rgb(0_0_0/0.7)] ring-2 ring-ink",
              isPinned && "z-10 ring-[3px] ring-signal ring-offset-2 ring-offset-background",
            )}
            style={{ gridColumn: t.col + 1, gridRow: t.row + 1 }}
          >
            {!l.empty && <span className="absolute inset-0">{l.fill}</span>}
            <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-[4px] ring-1 ring-inset", l.empty ? "ring-hairline" : "ring-black/25")} />
            <span
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center text-xs font-extrabold leading-none tracking-tight sm:text-sm lg:text-[15px]",
                l.empty ? "text-ink-faint" : l.inkOnFill === "dark" ? "text-ground" : "text-white",
              )}
              style={{ fontStretch: "112%" }}
            >
              {t.state}
              {l.sub && <span className="mt-1 hidden text-xs font-semibold tnum opacity-75 sm:block">{l.sub}</span>}
            </span>
            {l.corner && <span className="absolute right-1 top-1 hidden sm:block">{l.corner}</span>}
          </button>
        );
      })}
    </div>
  );
}
