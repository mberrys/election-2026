/**
 * Simplified cluster-residual projection (docs/research/05-kornacki-analytics.md section 1, needle-style).
 *
 *   residual[c]      = margin_now[c] - bench[c]          (only if pctExpected[c] >= minPctForResidual)
 *   cluster_resid[g] = sum(residual * votesIn) / sum(votesIn)   over units in g that have a residual
 *                      (falls back to the all-units residual, then 0)
 *   proj[c]          = bench[c] + w*residual[c] + (1-w)*cluster_resid[g(c)],  w = pctExpected[c]
 *                      (units without a residual use w = 0 -> bench + cluster_resid)
 *   state margin     = sum(proj[c] * EV[c]) / sum(EV[c])
 *
 * Uncertainty band heuristic (documented, not fitted):
 *   band = max(bandFloor, bandScale * (1 - pctIn)^bandExponent)   defaults 0.5, 12, 1.5
 *   pctIn = sum(votesIn) / sum(EV). At 0 % in that is +-12 pts (roughly a poll-vs-result miss ceiling),
 *   +-4.2 at 50 %, +-1.1 at 85 %, floor +-0.5 once essentially everything is in. The exponent > 1 keeps
 *   the band wide through the early, mode-skewed returns. Mode (early/eday) adjustment is NOT applied
 *   here; applyAnalytics inflates the band in known mirage states while pctIn < 0.5.
 */

export interface ProjectionUnitInput {
  id?: string;
  /** Current D - R margin (pts) among reported votes; undefined if nothing reported. */
  margin?: number;
  benchmarkMargin: number;
  /** 0-1 fraction. */
  pctExpected: number;
  expectedVote: number;
  /** Reported votes; defaults to pctExpected * expectedVote. */
  votesIn?: number;
  cluster?: string;
}

export interface ProjectionOptions {
  minPctForResidual?: number; // default 0.2
  bandFloor?: number; // default 0.5
  bandScale?: number; // default 12
  bandExponent?: number; // default 1.5
}

export interface ProjectedUnit {
  id?: string;
  cluster: string;
  residual?: number;
  clusterResidual: number;
  weight: number;
  projectedMargin: number;
  expectedVote: number;
}

export interface ProjectionResult {
  projectedMarginDR: number;
  band: number;
  pctIn: number;
  votesIn: number;
  totalExpectedVote: number;
  clusterResiduals: Record<string, number>;
  units: ProjectedUnit[];
}

export const DEFAULT_CLUSTER = "all";

export function uncertaintyBand(pctIn: number, opts: ProjectionOptions = {}): number {
  const floor = opts.bandFloor ?? 0.5;
  const scale = opts.bandScale ?? 12;
  const exp = opts.bandExponent ?? 1.5;
  const p = Math.min(Math.max(pctIn, 0), 1);
  return Math.max(floor, scale * Math.pow(1 - p, exp));
}

export function projectState(
  units: ReadonlyArray<ProjectionUnitInput>,
  opts: ProjectionOptions = {},
): ProjectionResult {
  const minPct = opts.minPctForResidual ?? 0.2;

  const prepared = units.map((u) => {
    const ev = Math.max(0, u.expectedVote);
    const pct = Math.min(Math.max(u.pctExpected, 0), 1);
    const votesIn = u.votesIn !== undefined ? Math.max(0, u.votesIn) : pct * ev;
    const residual = u.margin !== undefined && pct >= minPct ? u.margin - u.benchmarkMargin : undefined;
    return { u, ev, pct, votesIn, residual, cluster: u.cluster ?? DEFAULT_CLUSTER };
  });

  // Cluster-weighted mean residuals (weight = votes reported).
  const sums = new Map<string, { num: number; den: number }>();
  let gNum = 0;
  let gDen = 0;
  for (const p of prepared) {
    if (p.residual === undefined || p.votesIn <= 0) continue;
    const s = sums.get(p.cluster) ?? { num: 0, den: 0 };
    s.num += p.residual * p.votesIn;
    s.den += p.votesIn;
    sums.set(p.cluster, s);
    gNum += p.residual * p.votesIn;
    gDen += p.votesIn;
  }
  const globalResidual = gDen > 0 ? gNum / gDen : 0;
  const clusterResiduals: Record<string, number> = {};
  for (const p of prepared) {
    if (p.cluster in clusterResiduals) continue;
    const s = sums.get(p.cluster);
    clusterResiduals[p.cluster] = s && s.den > 0 ? s.num / s.den : globalResidual;
  }

  let projNum = 0;
  let evSum = 0;
  let votesSum = 0;
  const out: ProjectedUnit[] = prepared.map((p) => {
    const cr = clusterResiduals[p.cluster] ?? 0;
    const weight = p.residual === undefined ? 0 : p.pct;
    const projectedMargin = p.u.benchmarkMargin + weight * (p.residual ?? 0) + (1 - weight) * cr;
    projNum += projectedMargin * p.ev;
    evSum += p.ev;
    votesSum += p.votesIn;
    return {
      id: p.u.id,
      cluster: p.cluster,
      residual: p.residual,
      clusterResidual: cr,
      weight,
      projectedMargin,
      expectedVote: p.ev,
    };
  });

  const pctIn = evSum > 0 ? Math.min(votesSum / evSum, 1) : 0;
  return {
    projectedMarginDR: evSum > 0 ? projNum / evSum : 0,
    band: uncertaintyBand(pctIn, opts),
    pctIn,
    votesIn: votesSum,
    totalExpectedVote: evSum,
    clusterResiduals,
    units: out,
  };
}
