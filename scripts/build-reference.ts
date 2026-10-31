/**
 * Big Board reference-data build.
 *
 *   npx tsx scripts/build-reference.ts [--only=states,races,polls,money,baselines,history] [--no-cache] [--full]
 *
 * Writes public/data/reference/{states,races,polls,money,baselines,counties,history,sources,meta}.json.
 * Every step is isolated: a failure records a warning and the build continues.
 * HTTP responses are cached under scripts/.cache/http keyed by URL hash.
 */
import fs from "node:fs";
import path from "node:path";
import { RaceMeta, StateMeta } from "../src/data/schema";
import { setNoCache } from "./lib/http";
import { SOURCES, type SourceEntry } from "./lib/sources";
import { buildBaselines, type BaselinesOut, type CountyRow } from "./lib/step-baselines";
import { buildHistory } from "./lib/step-history";
import { buildMoney, type MoneyOut } from "./lib/step-money";
import { buildPolls, type PollsOut } from "./lib/step-polls";
import { buildRaces, type RacesResult } from "./lib/step-races";
import { buildStates, type StateMetaOut } from "./lib/step-states";
import { OUT_DIR, ensureDir, getWarnings, info, warn, writeJson } from "./lib/util";

type Step = "states" | "races" | "polls" | "money" | "baselines" | "history";
const ALL_STEPS: Step[] = ["states", "races", "polls", "money", "baselines", "history"];

function parseArgs(argv: string[]) {
  const only = new Set<Step>();
  let noCache = false;
  let full = false;
  for (const a of argv) {
    if (a === "--no-cache") noCache = true;
    else if (a === "--full") full = true;
    else if (a.startsWith("--only=")) {
      for (const s of a.slice(7).split(",")) {
        const t = s.trim() as Step;
        if (ALL_STEPS.includes(t)) only.add(t);
        else warn(`unknown step "${s}" in --only`);
      }
    } else if (a === "--help" || a === "-h") {
      process.stdout.write("usage: tsx scripts/build-reference.ts [--only=states,races,polls,money,baselines,history] [--no-cache] [--full]\n");
      process.exit(0);
    }
  }
  return { steps: only.size ? ALL_STEPS.filter((s) => only.has(s)) : ALL_STEPS, noCache, full };
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t0 = Date.now();
  process.stderr.write(`\n== ${name} ==\n`);
  try {
    const r = await fn();
    info(`${name} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return r;
  } catch (e) {
    warn(`${name} FAILED: ${(e as Error).stack ?? String(e)}`);
    return undefined;
  }
}

function loadExistingRaces(): RaceMeta[] | undefined {
  const f = path.join(OUT_DIR, "races.json");
  if (!fs.existsSync(f)) return undefined;
  try {
    const arr = JSON.parse(fs.readFileSync(f, "utf8")) as unknown[];
    return arr.map((r) => RaceMeta.parse(r));
  } catch (e) {
    warn(`could not load existing races.json: ${(e as Error).message}`);
    return undefined;
  }
}

async function main() {
  const { steps, noCache, full } = parseArgs(process.argv.slice(2));
  setNoCache(noCache);
  ensureDir(OUT_DIR);
  const builtAt = new Date().toISOString();
  const sourceStatus = new Map<string, Pick<SourceEntry, "status" | "statusNote">>();
  const setSrc = (id: string, status: SourceEntry["status"], note?: string) => sourceStatus.set(id, { status, statusNote: note });

  // ---- states ----
  let states: StateMetaOut[] | undefined;
  if (steps.includes("states")) {
    const r = await step("states", buildStates);
    if (r) {
      states = r.states;
      setSrc("greenpapers", r.pollCloseSource.startsWith("embedded") ? "fallback" : "ok", r.pollCloseSource);
      writeJson(path.join(OUT_DIR, "states.json"), states.map((s) => ({ ...StateMeta.parse(s), pollCloseSource: s.pollCloseSource })));
    }
  }

  // ---- races ----
  let races: RaceMeta[] | undefined;
  let racesResult: RacesResult | undefined;
  if (steps.includes("races")) {
    racesResult = await step("races", buildRaces);
    races = racesResult?.races;
    if (racesResult) {
      setSrc("wikipedia", races && races.length ? "ok" : "failed", `${racesResult.pages.length} pages`);
      setSrc("riotimes-dataroom", racesResult.rioTimes.reachable ? "ok" : "failed");
    }
  } else {
    races = loadExistingRaces();
    if (races) info(`loaded ${races.length} races from existing races.json`);
  }

  // ---- polls ----
  let polls: PollsOut | undefined;
  if (steps.includes("polls")) {
    polls = await step("polls", () => buildPolls(races ?? []));
    if (polls) {
      setSrc("votehub", polls.votehub.reachable ? "ok" : "failed", `HTTP ${polls.votehub.status}`);
      if (!sourceStatus.has("riotimes-dataroom")) setSrc("riotimes-dataroom", polls.riotimes.reachable ? "ok" : "failed");
      writeJson(path.join(OUT_DIR, "polls.json"), polls);
    }
  }

  // ---- money ----
  let money: MoneyOut | undefined;
  if (steps.includes("money")) {
    const apiKey = process.env.FEC_API_KEY ?? "DEMO_KEY";
    money = await step("money", () => buildMoney(races ?? [], { full, apiKey }));
    if (money) {
      setSrc("openfec", money.fecCandidates > 0 ? "ok" : "failed", `${money.apiKeyMode}; offices ${money.offices.join(",")}`);
      writeJson(path.join(OUT_DIR, "money.json"), money);
    }
  }

  // ---- baselines ----
  let baselines: BaselinesOut | undefined;
  let counties: Record<string, CountyRow> | undefined;
  if (steps.includes("baselines")) {
    const r = await step("baselines", () => buildBaselines(races ?? []));
    if (r) {
      baselines = r.baselines;
      counties = r.counties;
      setSrc("tonmcg-county", Object.keys(counties).length ? "ok" : "failed");
      setSrc("medsl-house", baselines.medsl.ok ? "ok" : "blocked", baselines.medsl.message);
      setSrc("downballot-presbycd", baselines.downballot.fetched ? "ok" : "failed", `${baselines.downballot.districts} districts`);
      writeJson(path.join(OUT_DIR, "baselines.json"), baselines);
      writeJson(path.join(OUT_DIR, "counties.json"), counties);
    }
  }

  // ---- history ----
  if (steps.includes("history")) {
    const history = await step("history", () => buildHistory(races ?? []));
    setSrc("medsl-president", history ? "ok" : "failed", history ? `${history.years.length} elections` : undefined);
    if (history) writeJson(path.join(OUT_DIR, "history.json"), history);
  }

  // ---- races.json (after enrichment) ----
  if (races) {
    const validated: RaceMeta[] = [];
    for (const r of races) {
      const v = RaceMeta.safeParse(r);
      if (v.success) validated.push(v.data);
      else warn(`final validation failed for ${r.id}: ${v.error.message}`);
    }
    validated.sort((a, b) => a.id.localeCompare(b.id));
    writeJson(path.join(OUT_DIR, "races.json"), validated);
    races = validated;
  }

  // ---- sources ----
  setSrc("research-vote-order", "ok");
  const sources = SOURCES.map((s) => ({ ...s, ...(sourceStatus.get(s.id) ?? { status: "skipped" as const }) }));
  writeJson(path.join(OUT_DIR, "sources.json"), sources);

  // ---- meta (steps skipped via --only report the on-disk outputs) ----
  const readJson = <T,>(name: string): T | undefined => {
    const f = path.join(OUT_DIR, name);
    if (!fs.existsSync(f)) return undefined;
    try {
      return JSON.parse(fs.readFileSync(f, "utf8")) as T;
    } catch {
      return undefined;
    }
  };
  states ??= readJson<StateMetaOut[]>("states.json");
  polls ??= readJson<PollsOut>("polls.json");
  money ??= readJson<MoneyOut>("money.json");
  baselines ??= readJson<BaselinesOut>("baselines.json");
  counties ??= readJson<Record<string, CountyRow>>("counties.json");
  const byOffice = (o: string) => (races ?? []).filter((r) => r.office === o);
  const house = byOffice("house");
  const houseMissingCands = house.filter((r) => !r.candidates.some((c) => c.party === "D") || !r.candidates.some((c) => c.party === "R")).map((r) => r.id);
  const houseNoCands = house.filter((r) => r.candidates.length === 0).map((r) => r.id);
  const houseNoRating = house.filter((r) => !r.ratings.consensus).map((r) => r.id);
  const ratedRaces = (races ?? []).filter((r) => r.office === "senate" || r.office === "house" || r.office === "governor");
  const withRating = ratedRaces.filter((r) => r.ratings.consensus).length;
  const fecCands = (races ?? []).filter((r) => r.office === "senate" || (money?.offices.includes("H") && r.office === "house")).flatMap((r) => r.candidates);
  const meta = {
    builtAt,
    args: { steps, noCache, full },
    counts: {
      states: states?.length ?? 0,
      races: races?.length ?? 0,
      senate: byOffice("senate").length,
      house: house.length,
      governor: byOffice("governor").length,
      ballot: byOffice("ballot").length,
      stateleg: byOffice("stateleg").length,
      candidates: (races ?? []).reduce((a, r) => a + r.candidates.length, 0),
      ratingsCoveragePct: ratedRaces.length ? Math.round((withRating / ratedRaces.length) * 1000) / 10 : 0,
      ratingsWithAllThree: ratedRaces.filter((r) => r.ratings.cook && r.ratings.inside && r.ratings.sabato).length,
      fecMatchedPct: fecCands.length ? Math.round((fecCands.filter((c) => c.fecId).length / fecCands.length) * 1000) / 10 : 0,
      fecMatchedCandidates: fecCands.filter((c) => c.fecId).length,
      fecEligibleCandidates: fecCands.length,
      racesWithPolls: (races ?? []).filter((r) => r.polls).length,
      racesWithMoney: (races ?? []).filter((r) => r.money).length,
      counties: counties ? Object.keys(counties).length : 0,
      houseWithPresBaseline: house.filter((r) => r.baseline.presMargin2024 !== undefined).length,
      houseWithPrevMargin: house.filter((r) => r.baseline.prevRaceMargin !== undefined).length,
    },
    coverage: {
      houseMissingMajorPartyCandidate: houseMissingCands,
      houseNoCandidates: houseNoCands,
      houseNoRating: houseNoRating,
      rioTimes: racesResult?.rioTimes,
      downballot: baselines?.downballot,
      medsl: baselines?.medsl,
      votehub: polls ? { reachable: polls.votehub.reachable, status: polls.votehub.status, racesWithPolls: Object.keys(polls.races).length } : undefined,
      pollCloseSource: states?.[0]?.pollCloseSource,
      wikipediaRevisions: racesResult?.pages,
    },
    warnings: getWarnings(),
  };
  writeJson(path.join(OUT_DIR, "meta.json"), meta);

  process.stderr.write("\n== summary ==\n");
  process.stderr.write(JSON.stringify(meta.counts, null, 2) + "\n");
  process.stderr.write(`warnings: ${meta.warnings.length}\n`);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});
