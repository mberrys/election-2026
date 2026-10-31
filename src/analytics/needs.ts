/**
 * "Needs X % of the remaining vote."
 *
 * Two-way split assumption: remaining votes go to D (share x) and R (share 1 - x).
 *   final D - R margin = (dVotes - rVotes) + remaining * (2x - 1)
 *   target             = targetMarginPts/100 * EV,  EV = dVotes + rVotes + otherVotes + remaining
 *   =>  x = ( 1 + (target - marginVotesNow) / remaining ) / 2
 *
 * This is the recipe's `(target_margin * EV - margin_votes_now) / remaining`, converted from a
 * D-R margin share of the remainder to a D vote share. Shares are 0-100; anything outside [0, 100]
 * is flagged impossible (the recipe's ">100 % or <-100 %" rule, in margin-share terms).
 */

export interface NeedsInput {
  dVotes: number;
  rVotes: number;
  /** Votes for other parties counted so far (only affects the EV the target is applied to). */
  otherVotes?: number;
  remaining: number;
  /** Desired final D - R margin in points. 0 = tie. Default 0. */
  targetMarginPts?: number;
}

export interface NeedsResult {
  /** Share (0-100) of remaining votes D needs for final D - R >= +target. May be outside 0-100 or +-Infinity. */
  dShare: number;
  /** Share (0-100) of remaining votes R needs for final R - D >= +target. */
  rShare: number;
  dImpossible: boolean;
  rImpossible: boolean;
  /** Vote margin (D - R) still to be made up to reach the target; negative means D is already past it. */
  dDeficitVotes: number;
}

function shareFor(lead: number, remaining: number, targetVotes: number): number {
  const deficit = targetVotes - lead;
  if (remaining <= 0) return deficit <= 0 ? 0 : Number.POSITIVE_INFINITY;
  return ((1 + deficit / remaining) / 2) * 100;
}

export function needsOfRemaining(input: NeedsInput): NeedsResult {
  const other = input.otherVotes ?? 0;
  const remaining = Math.max(0, input.remaining);
  const ev = input.dVotes + input.rVotes + other + remaining;
  const targetVotes = ((input.targetMarginPts ?? 0) / 100) * ev;
  const lead = input.dVotes - input.rVotes;
  const dShare = shareFor(lead, remaining, targetVotes);
  const rShare = shareFor(-lead, remaining, targetVotes);
  return {
    dShare,
    rShare,
    dImpossible: !(dShare >= 0 && dShare <= 100),
    rImpossible: !(rShare >= 0 && rShare <= 100),
    dDeficitVotes: targetVotes - lead,
  };
}

export interface LeadShare {
  /** Share (0-100) of remaining this candidate needs to finish at least tied with the best other candidate. */
  share: number;
  impossible: boolean;
}

/**
 * Race-level: for every candidate, the share of remaining votes they need to end up at least tied with
 * the strongest other candidate, assuming the remainder splits only between those two.
 *   x = (other - self + remaining) / (2 * remaining)
 */
export function requiredShareToLead(
  candidates: ReadonlyArray<{ id: string; votes: number }>,
  remaining: number,
): Record<string, LeadShare> {
  const out: Record<string, LeadShare> = {};
  const rem = Math.max(0, remaining);
  for (const c of candidates) {
    let bestOther = -Infinity;
    for (const o of candidates) if (o.id !== c.id && o.votes > bestOther) bestOther = o.votes;
    if (bestOther === -Infinity) {
      out[c.id] = { share: 0, impossible: false };
      continue;
    }
    const gap = bestOther - c.votes;
    let share: number;
    if (rem <= 0) share = gap <= 0 ? 0 : Number.POSITIVE_INFINITY;
    else share = Math.max(0, ((gap + rem) / (2 * rem)) * 100);
    out[c.id] = { share, impossible: !(share >= 0 && share <= 100) };
  }
  return out;
}
