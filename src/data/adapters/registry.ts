import type { Adapter } from "./types";
import { ncNcsbe } from "./nc-ncsbe";
import { gaEnhancedVoting, vaEnhancedVoting } from "./enhanced-voting";
import { caSos } from "./ca-sos";
import { mnSos } from "./mn-sos";
import { akDoe } from "./ak-doe";
import { iaClarity } from "./clarity";
import { wikipediaResults } from "./wikipedia-results";
import { isNytXcheckEnabled, nytXcheck } from "./nyt-xcheck";
import { isSimulation, simulator } from "./simulator";

/**
 * Production adapter list, in the order ingest runs them. Tier A official
 * statewide feeds first; the Wikipedia tier C stub last. `nyt-xcheck` is
 * appended ONLY when ENABLE_NYT_XCHECK=1 and must be filtered out of any
 * snapshot by the merge step (see nyt-xcheck.ts header).
 */
export const adapters: Adapter[] = isSimulation() ? [simulator] : [
  ncNcsbe,
  vaEnhancedVoting,
  gaEnhancedVoting,
  caSos,
  mnSos,
  akDoe,
  iaClarity,
  wikipediaResults,
  ...(isNytXcheckEnabled() ? [nytXcheck] : []),
];

export const adapterById = new Map(adapters.map((a) => [a.id, a]));

export { runAdapters } from "./types";
export type { Adapter, AdapterCtx, RunCtx, RunOptions, RunResult } from "./types";
