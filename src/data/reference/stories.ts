/**
 * Typed, server-side loader for the "campaign story so far" text in public/data/reference/stories.json,
 * produced by `npm run build:stories` (scripts/build-stories.ts).
 *
 * Every paragraph is copied from the cited Wikipedia article (CC BY-SA 4.0), so anything rendered from
 * this data must show the `source` attribution and link. Entries with `source.kind === "measure-summary"`
 * are the one-line ballot-measure summary already held in races.json, not a Wikipedia article.
 */
import storiesJson from "../../../public/data/reference/stories.json";

export type StorySourceKind = "wikipedia" | "measure-summary";

export interface StorySource {
  /** Article title (or, for measure summaries, the list article the summary came from). */
  title: string;
  url: string;
  /** Wikipedia revision the text was taken from. */
  revid?: number;
  kind: StorySourceKind;
}

export interface StoryCampaign {
  /** Matches `CandidateMeta.id` in races.json when this section is about a nominee. */
  candidateId?: string;
  /** Candidate name, or the source's own section heading for ballot measures ("Support", "Opposition", "Campaign"). */
  name: string;
  party?: string;
  /** Ballot measures only. Absent for a campaign section that is not split by side. */
  side?: "yes" | "no";
  paragraphs: string[];
}

export interface StoryKeyDate {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** A sentence from the source, unmodified. */
  text: string;
}

export interface RaceStory {
  source: StorySource;
  /** Up to 3 short paragraphs of plain text. Empty only when `campaigns` is non-empty. */
  overview: string[];
  /** Zero or more sections; empty when the source has nothing reliably attributable to a side. */
  campaigns: StoryCampaign[];
  keyDates?: StoryKeyDate[];
}

export interface StoriesFile {
  builtAt: string;
  license: "CC BY-SA 4.0";
  races: Record<string, RaceStory>;
}

const FILE = storiesJson as unknown as StoriesFile;

/** Story for a race id such as "senate:GA", "governor:MI", "house:NC-01" or "ballot:CA-prop-40". */
export function getStory(raceId: string): RaceStory | undefined {
  return Object.prototype.hasOwnProperty.call(FILE.races, raceId) ? FILE.races[raceId] : undefined;
}

/** When the stories were built, and the license that applies to all of the text. */
export function getStoriesMeta(): { builtAt: string; license: StoriesFile["license"] } {
  return { builtAt: FILE.builtAt, license: FILE.license };
}
