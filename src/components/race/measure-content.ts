/**
 * Reader- and search-facing text for a statewide ballot measure page (/race/ballot-ca-...). Built from the reference
 * data only, like race-content.ts, which keeps Senate, governor and House pages.
 */
import type { RaceMeta } from "@/data/schema";
import { getRace, getState, loadRaces } from "@/data/reference/load";
import { measureDescription, measureParts, measureTopics, TOPICS, type MeasureParts, type TopicId } from "@/components/states/states-lib";
import { raceSlug } from "./race-content";

export interface MeasureContentInput {
  meta: RaceMeta;
  state: NonNullable<ReturnType<typeof getState>>;
  parts: MeasureParts;
  summary?: string;
  topics: TopicId[];
  /** The other measures on the same state's ballot. */
  siblings: RaceMeta[];
}

let bySlug: Map<string, string> | undefined;

export function measurePageSlugs(): string[] {
  return loadRaces()
    .filter((r) => r.office === "ballot")
    .map(raceSlug);
}

export function measureContentInput(slug: string): MeasureContentInput | undefined {
  if (!bySlug) bySlug = new Map(loadRaces().filter((r) => r.office === "ballot").map((r) => [raceSlug(r), r.id]));
  const id = bySlug.get(slug);
  const meta = id ? getRace(id) : undefined;
  if (!meta) return undefined;
  const state = getState(meta.state);
  if (!state) return undefined;
  const siblings = loadRaces()
    .filter((r) => r.office === "ballot" && r.state === meta.state && r.id !== meta.id)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  return { meta, state, parts: measureParts(meta, state.name), summary: measureDescription(meta), topics: measureTopics(meta), siblings };
}

/** "California Prop 3: Renew State Income Tax Increase for Education Funding". */
export function measureHeading({ parts, state }: Pick<MeasureContentInput, "parts" | "state">): string {
  return parts.tag ? `${state.name} ${parts.tag}: ${parts.title}` : `${state.name}: ${parts.title}`;
}

export function measureTitle(input: MeasureContentInput): string {
  const t = measureHeading(input);
  return `${t.length > 70 ? `${t.slice(0, 69).trimEnd()}…` : t} (2026 ballot measure)`;
}

export function measureMetaDescription(input: MeasureContentInput): string {
  const base = input.summary ?? input.parts.title;
  const s = `${input.state.name} votes on this ${input.parts.kind?.toLowerCase() ?? "measure"} on Nov 3, 2026. ${base}`;
  return s.length > 300 ? `${s.slice(0, 299).trimEnd()}…` : s;
}

export function topicLabels(ids: TopicId[]): string[] {
  return ids.map((id) => TOPICS.find((t) => t.id === id)?.label ?? id);
}
