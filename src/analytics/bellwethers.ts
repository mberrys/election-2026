/**
 * Bellwethers: units whose lean tracks the state most closely across available baselines.
 *   lean_y[c] = margin_y[c] - margin_y[state]   for y in {2020, 2024} where both are known
 *   score     = mean(|lean_y|)
 * Rank ascending by score; ties go to the unit with more baselines.
 */

export interface BellwetherUnit {
  id: string;
  name?: string;
  margin2024?: number;
  margin2020?: number;
}

export interface BellwetherBaseline {
  margin2024?: number;
  margin2020?: number;
}

export interface Bellwether {
  id: string;
  name?: string;
  /** Mean signed lean (unit - state) across available baselines. */
  lean: number;
  /** Mean absolute lean; lower = better bellwether. */
  absLean: number;
  /** Number of baselines that contributed. */
  baselines: number;
}

export function rankBellwethers(
  units: ReadonlyArray<BellwetherUnit>,
  state: BellwetherBaseline,
  n = 10,
): Bellwether[] {
  const out: Bellwether[] = [];
  for (const u of units) {
    const leans: number[] = [];
    if (u.margin2024 !== undefined && state.margin2024 !== undefined) leans.push(u.margin2024 - state.margin2024);
    if (u.margin2020 !== undefined && state.margin2020 !== undefined) leans.push(u.margin2020 - state.margin2020);
    if (leans.length === 0) continue;
    const lean = leans.reduce((a, b) => a + b, 0) / leans.length;
    const absLean = leans.reduce((a, b) => a + Math.abs(b), 0) / leans.length;
    out.push({ id: u.id, name: u.name, lean, absLean, baselines: leans.length });
  }
  out.sort((a, b) => a.absLean - b.absLean || b.baselines - a.baselines || a.id.localeCompare(b.id));
  return out.slice(0, Math.max(0, n));
}
