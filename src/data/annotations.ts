import type { Race } from "./schema";

export type RaceFlag = NonNullable<Race["flags"]>[number];

export type Annotation = RaceFlag & {
  /** Exact race id ("senate:AK"), or omit and set `state` to apply to every race in a state. */
  raceId?: string;
  state?: string;
  /** Restrict a state-wide annotation to offices on the ballot it actually concerns. */
  offices?: Race["office"][];
};

/**
 * Hand-maintained legal/administrative context that changes how much a lead is worth.
 * Edit and redeploy to update (Vercel deploys in ~1 min). a pending `challengedBallots` feeds the call rule: a lead
 * smaller than the pool is never projected. Everything else is display-only.
 *
 * Seeded from Votebeat, 2026-10-29:
 * https://www.votebeat.org/national/2026/10/29/trump-lawsuits-midterm-california-alaska-washington-noncitizen-voters/
 */
const VOTEBEAT_1029 =
  "https://www.votebeat.org/national/2026/10/29/trump-lawsuits-midterm-california-alaska-washington-noncitizen-voters/";

export const ANNOTATIONS: Annotation[] = [
  {
    raceId: "senate:AK",
    kind: "litigation",
    summary:
      "DOJ has sued to block certification if Sen. Dan S. Sullivan loses narrowly, citing confusion with a second candidate, Dan J. Sullivan. Expedited in federal court; the state has moved to dismiss.",
    url: VOTEBEAT_1029,
    asOf: "2026-10-29",
  },
  {
    state: "CA",
    kind: "set-aside",
    summary:
      "DOJ demanded California set aside up to ~20,000 ballots from voters it alleges are noncitizens. A federal judge criticized the claims and an appeals court questioned them; counties say the lists include citizens.",
    url: VOTEBEAT_1029,
    challengedBallots: 20_000,
    asOf: "2026-10-29",
  },
  {
    state: "WA",
    kind: "set-aside",
    summary:
      "DOJ directed Washington to separate up to ~400 ballots it alleges are from noncitizens. Secretary of State Hobbs refused, saying the list includes citizens.",
    url: VOTEBEAT_1029,
    challengedBallots: 400,
    asOf: "2026-10-29",
  },
];

/** Annotations applying to one race (exact id match, or state-wide with an office filter). */
export function annotationsFor(race: Pick<Race, "id" | "state" | "office">, list: Annotation[] = ANNOTATIONS): RaceFlag[] {
  return list
    .filter(
      (a) =>
        a.raceId === race.id || (!a.raceId && a.state === race.state && (!a.offices || a.offices.includes(race.office))),
    )
    .map(({ kind, summary, url, challengedBallots, standing, asOf }) => ({ kind, summary, url, challengedBallots, standing, asOf }));
}

/**
 * Challenged pool that still holds back calls. A state-wide pool is not split by district: conservative for every race in the
 * state. A challenge marked `standing: "rejected"` is shown but no longer counts, since not every challenge is legitimate.
 */
export function challengedBallotsFor(flags: RaceFlag[] | undefined): number {
  return (flags ?? []).reduce((s, f) => s + (f.standing === "rejected" ? 0 : (f.challengedBallots ?? 0)), 0);
}
