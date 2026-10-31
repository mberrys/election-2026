/**
 * Election-night SIMULATOR — rehearsal only, never real results.
 *
 * Enabled with SIMULATE=1 (refused on Vercel production unless SIMULATE_IN_PROD=1). Replaces every real
 * adapter so simulated and real numbers can never mix. Plays out Nov 3 2026 for all Senate, governor and
 * House races:
 *  - Each statewide race is built county-by-county from 2024 presidential baselines, shifted by a uniform
 *    swing toward the pre-election consensus (polls → rating → prior margin) plus seeded noise.
 *  - Counties start reporting after the state's last poll close, each with its own lag and pace.
 *  - Early/mail ballots come first in "early-first" states (D-leaning), election-day first in "eday-first"
 *    states, so mirage effects show up in the analytics.
 *
 * Clock: SIM_START (ISO wall-clock instant the night starts; default = first ingest after server boot),
 * SIM_SPEED (sim minutes per real minute, default 30 → the 7-hour night plays in ~14 minutes),
 * SIM_SEED (default 2026). Sim time starts at 6:45 PM ET Nov 3 (23:45Z).
 */
import type { Adapter, AdapterCtx } from "./types";
import type { CandidateMeta, CandidateResult, Race, RaceMeta, ReportingUnit, StateMeta } from "../schema";
import { assembleRace, makeUnit } from "./util/race";
import { loadCounties, loadStates, type CountyBaseline } from "../reference/load";
import { pollCloseUtc } from "../election-gate";
import { expectedStateMargin } from "../../analytics";

const SIM_EPOCH = Date.parse("2026-11-03T23:45:00Z");
// Kept on globalThis so dev hot-reloads (which re-evaluate this module) do not restart the night.
const g = globalThis as { __bigboardSimStart?: number };

export function isSimulation(): boolean {
  if (process.env.SIMULATE !== "1") return false;
  if (process.env.VERCEL_ENV === "production" && process.env.SIMULATE_IN_PROD !== "1") return false;
  return true;
}

/** Simulated wall clock for a real instant. */
export function simNow(real: Date): Date {
  const start = process.env.SIM_START ? Date.parse(process.env.SIM_START) : (g.__bigboardSimStart ??= real.getTime());
  const speed = Number(process.env.SIM_SPEED ?? 30);
  return new Date(SIM_EPOCH + (real.getTime() - start) * speed);
}

// ---- seeded randomness ----
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(key: string): () => number {
  let a = hash(`${process.env.SIM_SEED ?? "2026"}:${key}`);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ---- vote math ----
const OTHER_SHARE = 0.025;
const MIDTERM_RATIO = 0.72;

/**
 * SIM_SCENARIO=contested — situations from pre-election reporting (Votebeat/TIME, Oct 2026):
 *  - AK Senate finishes razor-thin while a namesake spoiler (Dan J. Sullivan) draws ~3%.
 *  - GA Senate is close and federal agents seize Fulton County ballots: its count freezes 9:30 PM → 1:30 AM ET.
 *  - Philadelphia (PA, not on the base watch list) halts 10:00 PM → 12:30 AM ET.
 */
const SCENARIO = process.env.SIM_SCENARIO ?? "";
const CONTESTED = {
  finalMargin: { "senate:AK": 0.4, "senate:GA": 1.2 } as Record<string, number>,
  otherShare: { "senate:AK": 0.03 } as Record<string, number>,
  seizures: [
    {
      fips: "13121",
      state: "GA",
      from: Date.parse("2026-11-04T02:30:00Z"),
      to: Date.parse("2026-11-04T06:30:00Z"),
      summary: "SIMULATED: federal agents seized Fulton County ballots; count paused pending a court order.",
    },
    {
      // Not on the base watch list: proves the Integrity Watch picks up new states on its own.
      fips: "42101",
      state: "PA",
      from: Date.parse("2026-11-04T03:00:00Z"),
      to: Date.parse("2026-11-04T05:30:00Z"),
      summary: "SIMULATED: Philadelphia count halted after a federal warrant for voting equipment.",
    },
  ],
};
const contested = () => SCENARIO === "contested";

function split(votes: number, marginDR: number, otherShare = OTHER_SHARE) {
  const two = 1 - otherShare;
  const m = Math.max(-0.97, Math.min(0.97, marginDR / 100));
  return {
    d: Math.max(0, Math.round((votes * (two + m)) / 2)),
    r: Math.max(0, Math.round((votes * (two - m)) / 2)),
    o: Math.round(votes * otherShare),
  };
}

/** Fraction of a unit's final vote counted at sim time t. */
function reportedFraction(t: number, closeMs: number, r: () => number, size: number): number {
  const lag = (5 + r() * 35) * 60_000;
  const pace = (60 + r() * 120 + Math.log10(Math.max(10, size)) * 25) * 60_000;
  const x = clamp01((t - closeMs - lag) / pace);
  // Last ~2% (provisional/late mail) only arrives well after the main count.
  const tail = t > closeMs + lag + pace * 2.2 ? 1 : 0.98;
  return Math.min(tail, Math.pow(x, 0.85));
}

/** Split counted votes into modes and give each its own margin so mirages appear. */
function countByMode(
  total: number,
  frac: number,
  trueMargin: number,
  order: StateMeta["voteOrder"],
  otherShare = OTHER_SHARE,
): { modes: { early: number; electionDay: number }; d: number; r: number; o: number } {
  const counted = Math.round(total * frac);
  const firstShare = order === "eday-first" ? 0.55 : 0.62;
  const firstShift = order === "early-first" ? 9 : order === "eday-first" ? -9 : 0;
  // Second tranche's margin chosen so the full count lands exactly on trueMargin.
  const secondShift = (-firstShift * firstShare) / (1 - firstShare);
  const firstVotes = Math.min(counted, Math.round(total * firstShare));
  const secondVotes = counted - firstVotes;
  const a = split(firstVotes, trueMargin + firstShift, otherShare);
  const b = split(secondVotes, trueMargin + secondShift, otherShare);
  const early = order === "eday-first" ? secondVotes : firstVotes;
  return { modes: { early, electionDay: counted - early }, d: a.d + b.d, r: a.r + b.r, o: a.o + b.o };
}

/** Main D and R are the incumbent if any, else the best-funded / FEC-matched candidate, else first listed. */
function pickCandidates(meta: RaceMeta): { d?: CandidateMeta; r?: CandidateMeta; o?: CandidateMeta } {
  const cash = meta.money?.receipts ?? {};
  const best = (party: CandidateMeta["party"]) =>
    meta.candidates
      .filter((c) => c.party === party)
      .sort(
        (a, b) =>
          Number(b.incumbent) - Number(a.incumbent) ||
          (cash[b.id] ?? -1) - (cash[a.id] ?? -1) ||
          Number(!!b.fecId) - Number(!!a.fecId),
      )[0];
  const d = best("D") ?? best("I");
  const r = best("R");
  // Spoiler/third slot: a namesake of a major candidate if one exists (AK Dan J. Sullivan), else anyone else.
  const surname = (c?: CandidateMeta) => c?.name.split(" ").pop()?.toLowerCase();
  const others = meta.candidates.filter((c) => c !== d && c !== r);
  const o = others.find((c) => surname(c) === surname(r) || surname(c) === surname(d)) ?? others[0];
  return { d, r, o };
}

function results(meta: RaceMeta, d: number, r: number, o: number): CandidateResult[] {
  const { d: cd, r: cr, o: co } = pickCandidates(meta);
  const out: CandidateResult[] = [];
  const add = (c: CandidateMeta | undefined, votes: number) =>
    c && out.push({ id: c.id, name: c.name, party: c.party, votes, pct: 0, incumbent: c.incumbent });
  add(cd, d);
  add(cr, r);
  add(co, co ? o : 0);
  return out;
}

function unitVotes(meta: RaceMeta, d: number, r: number, o: number): Record<string, number> {
  return Object.fromEntries(results(meta, d, r, o).map((c) => [c.id, c.votes]));
}

function simStatewide(meta: RaceMeta, st: StateMeta, counties: [string, CountyBaseline][], t: number, ctx: AdapterCtx): Race {
  const closeMs = pollCloseUtc(st).getTime();
  const raceR = rng(meta.id);
  const totalT = counties.reduce((s, [, c]) => s + (c.turnout2024 ?? 0), 0) || 1;
  const state2024 = counties.reduce((s, [, c]) => s + (c.margin2024 ?? 0) * (c.turnout2024 ?? 0), 0) / totalT;
  const target = contested() ? CONTESTED.finalMargin[meta.id] : undefined;
  const otherShare = (contested() && CONTESTED.otherShare[meta.id]) || OTHER_SHARE;
  // polling miss, shared by all counties (or pinned so the race finishes at the scenario margin)
  const stateError = target != null ? target - expectedStateMargin(meta) : gauss(raceR) * 3;
  const seizures = contested() ? CONTESTED.seizures.filter((z) => z.state === meta.state) : [];
  let paused: (typeof seizures)[number] | undefined;
  const swing = expectedStateMargin(meta) + stateError - state2024;

  const units: ReportingUnit[] = [];
  let modesE = 0;
  let modesED = 0;
  for (const [fips, c] of counties) {
    const r = rng(`${meta.id}:${fips}`);
    const total = Math.round((c.turnout2024 ?? 0) * MIDTERM_RATIO);
    const trueMargin = (c.margin2024 ?? state2024) + swing + gauss(r) * 2.5;
    let frac = reportedFraction(t, closeMs, r, total);
    const z = seizures.find((x) => x.fips === fips && t >= x.from && t < x.to);
    if (z) {
      // Same seed → same lag/pace draws, so this is exactly where the count stood when it was seized.
      frac = Math.min(frac, reportedFraction(z.from, closeMs, rng(`${meta.id}:${fips}`), total));
      paused = z;
    }
    const v = countByMode(total, frac, trueMargin, st.voteOrder, otherShare);
    modesE += v.modes.early;
    modesED += v.modes.electionDay;
    const precinctsTotal = Math.max(1, Math.round(total / 2500));
    units.push(
      makeUnit(
        {
          id: fips,
          fips,
          name: c.name,
          precinctsTotal,
          precinctsReporting: Math.floor(precinctsTotal * frac),
          modes: { early: v.modes.early, electionDay: v.modes.electionDay },
        },
        unitVotes(meta, v.d, v.r, v.o),
      ),
    );
  }
  const candidates = results(
    meta,
    units.reduce((s, u) => s + (u.votes[pickCandidates(meta).d?.id ?? ""] ?? 0), 0),
    units.reduce((s, u) => s + (u.votes[pickCandidates(meta).r?.id ?? ""] ?? 0), 0),
    units.reduce((s, u) => s + (u.votes[pickCandidates(meta).o?.id ?? ""] ?? 0), 0),
  );
  const race = assembleRace({
    id: meta.id,
    office: meta.office,
    state: meta.state,
    special: meta.special,
    name: meta.name,
    candidates,
    units,
    precinctsTotal: units.reduce((s, u) => s + (u.precinctsTotal ?? 0), 0),
    precinctsReporting: units.reduce((s, u) => s + (u.precinctsReporting ?? 0), 0),
    modes: { early: modesE, electionDay: modesED },
    source: { adapter: "simulator", tier: "A", attribution: "SIMULATION — not real results" },
    ctx,
  });
  if (paused) race.flags = [{ kind: "count-paused", summary: paused.summary, asOf: new Date(t).toISOString() }];
  return race;
}

function simHouse(meta: RaceMeta, st: StateMeta, t: number, ctx: AdapterCtx): Race {
  const r = rng(meta.id);
  const closeMs = pollCloseUtc(st).getTime();
  // Size districts like the expected-vote baseline does (ingest gives House metas state turnout ÷ districts).
  const total = Math.round((meta.baseline.turnout2024 ?? 330_000) * MIDTERM_RATIO * (0.9 + r() * 0.2));
  const trueMargin = expectedStateMargin(meta) + gauss(r) * 4;
  const frac = reportedFraction(t, closeMs, r, total);
  const v = countByMode(total, frac, trueMargin, st.voteOrder);
  const precinctsTotal = 200;
  return assembleRace({
    id: meta.id,
    office: "house",
    state: meta.state,
    district: meta.district,
    name: meta.name,
    candidates: results(meta, v.d, v.r, v.o),
    precinctsTotal,
    precinctsReporting: Math.floor(precinctsTotal * frac),
    modes: v.modes,
    source: { adapter: "simulator", tier: "A", attribution: "SIMULATION — not real results" },
    ctx,
  });
}

export const simulator: Adapter = {
  id: "simulator",
  tier: "A",
  states: ["ALL"],
  cadenceSec: 60,
  async fetch(ctx) {
    const t = simNow(ctx.now).getTime();
    const states = new Map(loadStates().map((s) => [s.abbr, s]));
    const byState = new Map<string, [string, CountyBaseline][]>();
    for (const entry of Object.entries(loadCounties())) {
      const list = byState.get(entry[1].state) ?? [];
      list.push(entry);
      byState.set(entry[1].state, list);
    }
    const out: Race[] = [];
    for (const meta of ctx.metas.values()) {
      const st = states.get(meta.state);
      if (!st) continue;
      if (meta.office === "senate" || meta.office === "governor") {
        const counties = byState.get(meta.state);
        if (counties?.length) out.push(simStatewide(meta, st, counties, t, ctx));
      } else if (meta.office === "house") {
        out.push(simHouse(meta, st, t, ctx));
      }
    }
    ctx.log(`sim clock ${new Date(t).toISOString()} → ${out.length} races`);
    return out;
  },
};
