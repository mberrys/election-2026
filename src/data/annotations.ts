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
 * Edit and redeploy to update (Vercel deploys in ~1 min). A pending `challengedBallots` feeds the call rule: a lead
 * smaller than the pool is never projected. Everything else is display-only.
 *
 * Each entry is a dated snapshot with several sources, not a standing fact: re-check `standing` and `asOf` before relying on
 * it, and mark a challenge `standing: "rejected"` once a court has turned it down.
 */
const VOTEBEAT = { name: "Votebeat", url: "https://www.votebeat.org/national/2026/10/29/trump-lawsuits-midterm-california-alaska-washington-noncitizen-voters/" };

export const ANNOTATIONS: Annotation[] = [
  {
    raceId: "senate:AK",
    kind: "litigation",
    summary:
      "DOJ has sued to block certification only if Sen. Dan S. Sullivan loses and moving the votes cast for a second candidate, Dan J. Sullivan, to him would flip the result. A federal judge signaled skepticism of the legal theory at a hearing; no final ruling yet.",
    sources: [
      VOTEBEAT,
      { name: "ABC News", url: "https://abcnews.com/Politics/judge-appears-skeptical-dojs-legal-maneuvering-alaska-lawsuit/story?id=137590192" },
    ],
    asOf: "2026-10-31",
  },
  {
    state: "CA",
    kind: "set-aside",
    summary:
      "DOJ demanded California set aside up to ~20,000 ballots from voters it alleges are noncitizens. A federal district judge refused, saying it would disrupt voting and questioning the list, and the Ninth Circuit rejected the emergency appeal. Counties say the lists include citizens. The underlying lawsuit continues.",
    sources: [
      VOTEBEAT,
      { name: "CBS News", url: "https://www.cbsnews.com/news/judge-rejects-trump-california-mail-ballots/" },
      { name: "PBS NewsHour", url: "https://www.pbs.org/newshour/politics/judge-denies-federal-request-to-segregate-california-ballots-says-it-would-wreak-havoc-on-voting" },
      { name: "Axios", url: "https://www.axios.com/2026/10/30/doj-california-noncitizen-voter-list-court" },
    ],
    challengedBallots: 20_000,
    standing: "rejected",
    asOf: "2026-10-31",
  },
  {
    state: "WA",
    kind: "set-aside",
    summary:
      "DOJ directed Washington to separate up to ~400 ballots it alleges are from noncitizens. Secretary of State Hobbs refused, saying the list includes citizens. No court ruling found as of this date.",
    sources: [VOTEBEAT],
    challengedBallots: 400,
    asOf: "2026-10-31",
  },
];

/** Annotations applying to one race (exact id match, or state-wide with an office filter). */
export function annotationsFor(race: Pick<Race, "id" | "state" | "office">, list: Annotation[] = ANNOTATIONS): RaceFlag[] {
  return list
    .filter(
      (a) =>
        a.raceId === race.id || (!a.raceId && a.state === race.state && (!a.offices || a.offices.includes(race.office))),
    )
    .map(({ kind, summary, url, sources, challengedBallots, standing, asOf }) => ({ kind, summary, url, sources, challengedBallots, standing, asOf }));
}

/**
 * Challenged pool that still holds back calls. A state-wide pool is not split by district: conservative for every race in the
 * state. A challenge marked `standing: "rejected"` is shown but no longer counts, since not every challenge is legitimate.
 */
export function challengedBallotsFor(flags: RaceFlag[] | undefined): number {
  return (flags ?? []).reduce((s, f) => s + (f.standing === "rejected" ? 0 : (f.challengedBallots ?? 0)), 0);
}
