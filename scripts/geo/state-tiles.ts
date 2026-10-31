/**
 * 50-state + DC tile grid in the familiar NPR / Bloomberg layout.
 * col grows east, row grows south. 12 columns × 8 rows.
 */
import { ABBR_TO_STATE } from "./constants";

export interface StateTile {
  state: string;
  name: string;
  fips: string;
  col: number;
  row: number;
}

const LAYOUT: [string, number, number][] = [
  ["AK", 0, 0], ["ME", 11, 0],
  ["VT", 10, 1], ["NH", 11, 1],
  ["WA", 1, 2], ["ID", 2, 2], ["MT", 3, 2], ["ND", 4, 2], ["MN", 5, 2], ["IL", 6, 2],
  ["WI", 7, 2], ["MI", 8, 2], ["NY", 9, 2], ["RI", 10, 2], ["MA", 11, 2],
  ["OR", 1, 3], ["NV", 2, 3], ["WY", 3, 3], ["SD", 4, 3], ["IA", 5, 3], ["IN", 6, 3],
  ["OH", 7, 3], ["PA", 8, 3], ["NJ", 9, 3], ["CT", 10, 3],
  ["CA", 1, 4], ["UT", 2, 4], ["CO", 3, 4], ["NE", 4, 4], ["MO", 5, 4], ["KY", 6, 4],
  ["WV", 7, 4], ["VA", 8, 4], ["MD", 9, 4], ["DE", 10, 4],
  ["AZ", 2, 5], ["NM", 3, 5], ["KS", 4, 5], ["AR", 5, 5], ["TN", 6, 5], ["NC", 7, 5],
  ["SC", 8, 5], ["DC", 9, 5],
  ["OK", 4, 6], ["LA", 5, 6], ["MS", 6, 6], ["AL", 7, 6], ["GA", 8, 6],
  ["HI", 0, 7], ["TX", 4, 7], ["FL", 9, 7],
];

export function buildStateTiles(): { cols: number; rows: number; tiles: StateTile[] } {
  const tiles = LAYOUT.map(([state, col, row]) => {
    const info = ABBR_TO_STATE[state];
    if (!info) throw new Error(`unknown state ${state}`);
    return { state, name: info.name, fips: info.fips, col, row };
  });
  if (tiles.length !== 51) throw new Error(`expected 51 tiles, got ${tiles.length}`);
  const seen = new Set(tiles.map((t) => `${t.col},${t.row}`));
  if (seen.size !== tiles.length) throw new Error("duplicate tile position");
  return {
    cols: Math.max(...tiles.map((t) => t.col)) + 1,
    rows: Math.max(...tiles.map((t) => t.row)) + 1,
    tiles,
  };
}
