/**
 * Typed loaders for the build-time reference data in public/data/reference/.
 * The JSON files are imported statically so Next bundles them; they are produced by
 * `npx tsx scripts/build-reference.ts` and validated against src/data/schema.ts there.
 */
import type { z } from "zod";
import type { Baseline, History, Office, PollAverage as PollAverageSchema, RaceMeta, StateMeta } from "../schema";
import countiesJson from "../../../public/data/reference/counties.json";
import historyJson from "../../../public/data/reference/history.json";
import metaJson from "../../../public/data/reference/meta.json";
import pollsJson from "../../../public/data/reference/polls.json";
import racesJson from "../../../public/data/reference/races.json";
import sourcesJson from "../../../public/data/reference/sources.json";
import statesJson from "../../../public/data/reference/states.json";

type PollAverage = z.infer<typeof PollAverageSchema>;

export type StateRef = StateMeta & { pollCloseSource?: string };

export interface CountyBaseline {
  margin2024?: number;
  margin2020?: number;
  turnout2024?: number;
  turnout2020?: number;
  state: string;
  name: string;
}

export interface GenericBallot {
  riotimes?: { d: number; r: number; margin: number; asOf: string; method: string; license: string; sources: unknown[] };
  votehub?: PollAverage & { windowDays?: number; pollsters?: number };
}

export interface TrendPoint {
  /** Week-ending date, YYYY-MM-DD. */
  t: string;
  d: number;
  r: number;
  n: number;
}

export interface PollsRef {
  builtAt: string;
  generic: GenericBallot;
  races: Record<string, PollAverage>;
  /** Weekly rolling poll averages since January: "generic" plus race ids with enough polls. */
  trend?: Record<string, TrendPoint[]>;
  votehub: { reachable: boolean; status: number; auth: string; endpoints: string[]; filters: string[]; note: string };
  riotimes: { reachable: boolean; status: number; updated?: string };
}

export interface SourceRef {
  id: string;
  name: string;
  url: string;
  license: string;
  attribution: string;
  cadence: string;
  usedFor: string[];
  status?: "ok" | "failed" | "blocked" | "fallback" | "skipped";
  statusNote?: string;
}

const races = racesJson as unknown as RaceMeta[];
const states = statesJson as unknown as StateRef[];
const counties = countiesJson as unknown as Record<string, CountyBaseline>;
const polls = pollsJson as unknown as PollsRef;
const history = historyJson as unknown as z.infer<typeof History>;
const sources = sourcesJson as unknown as SourceRef[];

let raceById: Map<string, RaceMeta> | undefined;
let racesByState: Map<string, RaceMeta[]> | undefined;
let racesByOffice: Map<Office, RaceMeta[]> | undefined;
let stateByAbbr: Map<string, StateRef> | undefined;

export function loadRaces(): RaceMeta[] {
  return races;
}

export function loadStates(): StateRef[] {
  return states;
}

export function loadCounties(): Record<string, CountyBaseline> {
  return counties;
}

export function loadPolls(): PollsRef {
  return polls;
}

export function loadHistory(): z.infer<typeof History> {
  return history;
}

/** When the reference data was last rebuilt by any step; every build, partial or full, rewrites it. */
export function loadBuiltAt(): string {
  return metaJson.builtAt;
}

export function loadSources(): SourceRef[] {
  return sources;
}

export function getRaceById(): Map<string, RaceMeta> {
  if (!raceById) raceById = new Map(races.map((r) => [r.id, r]));
  return raceById;
}

export function getRace(id: string): RaceMeta | undefined {
  return getRaceById().get(id);
}

export function getRacesByState(): Map<string, RaceMeta[]> {
  if (!racesByState) {
    racesByState = new Map();
    for (const r of races) {
      const arr = racesByState.get(r.state) ?? [];
      arr.push(r);
      racesByState.set(r.state, arr);
    }
  }
  return racesByState;
}

export function getRacesByOffice(): Map<Office, RaceMeta[]> {
  if (!racesByOffice) {
    racesByOffice = new Map();
    for (const r of races) {
      const arr = racesByOffice.get(r.office) ?? [];
      arr.push(r);
      racesByOffice.set(r.office, arr);
    }
  }
  return racesByOffice;
}

export function getStateByAbbr(): Map<string, StateRef> {
  if (!stateByAbbr) stateByAbbr = new Map(states.map((s) => [s.abbr, s]));
  return stateByAbbr;
}

export function getState(abbr: string): StateRef | undefined {
  return getStateByAbbr().get(abbr.toUpperCase());
}

export function getBaseline(raceId: string): Baseline | undefined {
  return getRace(raceId)?.baseline;
}

export function getCounty(fips: string): CountyBaseline | undefined {
  return counties[fips.padStart(5, "0")];
}
