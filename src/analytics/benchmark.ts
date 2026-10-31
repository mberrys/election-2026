/**
 * County benchmarks (docs/research/05-kornacki-analytics.md section 1).
 * All margins are D - R in percentage points; negative = R.
 */

/** swing = expected state margin - 2024 state margin. */
export function uniformSwing(stateMargin2024: number, stateExpectedMargin: number): number {
  return stateExpectedMargin - stateMargin2024;
}

/** bench_margin[c] = M24[c] + swing: the margin this unit should show if the state lands on expectation. */
export function uniformSwingBenchmark(
  unitMargin2024: number,
  stateMargin2024: number,
  stateExpectedMargin: number,
): number {
  return unitMargin2024 + uniformSwing(stateMargin2024, stateExpectedMargin);
}

/** 538-style tied-race benchmark: tie_margin[c] = M24[c] - M24_state (unit lean relative to the state). */
export function tieMargin(unitMargin2024: number, stateMargin2024: number): number {
  return unitMargin2024 - stateMargin2024;
}

/** over[c] = margin_now - bench; positive means D is beating the benchmark. */
export function overUnder(currentMargin: number, benchmarkMargin: number): number {
  return currentMargin - benchmarkMargin;
}
