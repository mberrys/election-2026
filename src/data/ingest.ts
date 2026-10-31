import type { FeedStatus, Race, RaceMeta, Snapshot, StateMeta } from "./schema";
import { Snapshot as SnapshotSchema } from "./schema";
import { acquireLock, nextSeq, readNational, readState, releaseLock, writeSnapshot } from "@/lib/snapshot-store";
import { adapters, runAdapters } from "./adapters/registry";
import { applyAnalytics, computeBalance, SENATE_NOT_UP_2026 } from "@/analytics";
import { loadCounties, loadRaces, loadStates } from "./reference/load";
import { pollsClosed, zeroRace } from "./election-gate";
import { ANNOTATIONS, annotationsFor, type Annotation } from "./annotations";
import { readSlow } from "@/lib/snapshot-store";
import { isSimulation, simNow } from "./adapters/simulator";
import { resolveWatch, stalledMinutes, WATCH_MIN_PCT } from "./watch";

export type IngestResult = {
  ok: boolean;
  skipped?: string;
  seq?: number;
  races?: number;
  feeds?: FeedStatus[];
  ms: number;
  error?: string;
};

/**
 * One ingest pass: run every adapter with isolation → merge with the previous snapshot (so a failing feed keeps
 * its last good races) → analytics → balance of power → write. Guarded by a Redis lock.
 */
export async function runIngest({ reason, timeoutMs = 25_000 }: { reason: string; timeoutMs?: number }): Promise<IngestResult> {
  const t0 = Date.now();
  if (!(await acquireLock(110))) return { ok: false, skipped: "locked", ms: Date.now() - t0 };

  try {
    const metas = loadRaces();
    const states = loadStates();
    const counties = new Map(Object.entries(loadCounties()));
    const metaById = new Map<string, RaceMeta>(withHouseTurnout(metas, counties).map((m) => [m.id, m]));
    const stateByAbbr = new Map<string, StateMeta>(states.map((s) => [s.abbr, s]));

    const controller = new AbortController();
    const { races: fresh, feeds } = await runAdapters(
      adapters,
      {
        fetch: globalThis.fetch,
        liveNetwork: true,
        now: new Date(),
        signal: controller.signal,
        log: (msg: string) => console.log(`[ingest:${reason}] ${msg}`),
        metas: metaById,
      },
      { timeoutMs, concurrency: 6 },
    );

    // Merge: start from previous snapshot so a feed outage doesn't blank a state.
    const prev = await readNational();
    const prevById = new Map<string, Omit<Race, "units">>((prev?.races ?? []).map((r) => [r.id, r]));
    const okAdapters = new Set(feeds.filter((f) => f.ok).map((f) => f.adapter));
    const merged = new Map<string, Race>();
    for (const r of prevById.values()) {
      if (!okAdapters.has(r.source.adapter)) merged.set(r.id, { ...r, units: [] });
    }
    for (const r of fresh) {
      if (r.source.adapter === "nyt-xcheck") continue; // private cross-check only; never persisted or rendered
      const existing = merged.get(r.id);
      // Prefer higher tier (A < B < C) when two adapters report the same race.
      if (!existing || existing.source.tier >= r.source.tier) merged.set(r.id, r);
    }

    const history = new Map<string, string | undefined>(
      (prev?.races ?? []).map((r) => [r.id, r.leaderId]),
    );

    // Static annotations + any posted at runtime via /api/annotations, + simulator-generated ones.
    const annotations: Annotation[] = [...ANNOTATIONS, ...((await readSlow<Annotation[]>("annotations")) ?? [])];
    // Watch list as of this tick: base + annotated states + states that stalled earlier tonight.
    const prevWatch = prev?.watch ?? [];
    const watchNow = new Set(resolveWatch({ annotations, previous: prevWatch }).map((w) => w.state));
    const analyzed: Race[] = [];
    const now = new Date();
    const gated = new Set<string>();
    for (const raw of merged.values()) {
      const meta = metaById.get(raw.id);
      const st = stateByAbbr.get(raw.state);
      const open = !pollsClosed(st, now);
      if (open && raw.totalVotes > 0) gated.add(raw.state);
      // Carry the previous projection forward so the call rule can keep it sticky (adapters never set it).
      const prevProj = prevById.get(raw.id)?.projection;
      const withPrior = prevProj && !raw.projection ? { ...raw, projection: prevProj } : raw;
      const flags = [...annotationsFor(raw, annotations), ...(raw.flags ?? [])];
      const flagged = flags.length ? { ...withPrior, flags } : withPrior;
      const race = open ? { ...zeroRace(raw), ...(flags.length ? { flags } : {}) } : flagged;
      if (open) {
        analyzed.push(race); // no analytics on zeroed pre-close data
        continue;
      }
      try {
        analyzed.push(
          applyAnalytics(race, meta, st, counties, {
            prevLeaderId: history.get(race.id),
            ...(watchNow.has(race.state) ? { minPctExpected: WATCH_MIN_PCT } : {}),
          }),
        );
      } catch (e) {
        console.error(`[ingest] analytics failed for ${race.id}`, e);
        analyzed.push(race);
      }
    }

    // Stalled-count tracking. In simulation the night runs on the sim clock, so measure stalls there.
    const clock = isSimulation() ? simNow(now) : now;
    for (const r of analyzed) {
      const p = prevById.get(r.id);
      r.lastChangeAt = p && p.totalVotes === r.totalVotes ? (p.lastChangeAt ?? clock.toISOString()) : clock.toISOString();
    }
    // County-level stalls in EVERY state with county data (a seized or court-paused county hides inside a moving
    // statewide total). A stall anywhere adds that state to the Integrity Watch.
    const unitStalls: { text: string; severity: number }[] = [];
    const stalledStates = new Set<string>();
    for (const st of new Set(analyzed.filter((r) => r.office !== "house" && r.units.length).map((r) => r.state))) {
      const prevState = await readState(st);
      const prevUnits = new Map(
        (prevState?.races ?? []).flatMap((r) => r.units.map((u) => [`${r.id}|${u.id}`, u] as const)),
      );
      for (const r of analyzed) {
        if (r.state !== st || r.office === "house" || !r.units.length) continue;
        for (const u of r.units) {
          const pu = prevUnits.get(`${r.id}|${u.id}`);
          u.lastChangeAt =
            pu && pu.totalVotes === u.totalVotes ? (pu.lastChangeAt ?? clock.toISOString()) : clock.toISOString();
          const mins = stalledMinutes(
            { lastChangeAt: u.lastChangeAt, pctExpected: u.pctExpected, totalVotes: u.totalVotes, precinctsReporting: u.precinctsReporting, precinctsTotal: u.precinctsTotal },
            clock.getTime(),
          );
          // Only counties big enough to matter: outstanding vote larger than the statewide margin.
          const outstanding = (u.expectedVote ?? 0) - u.totalVotes;
          const marginVotes = Math.abs((r.marginPts ?? 0) / 100) * r.totalVotes;
          // A big frozen county is an integrity signal even in a lopsided race: it puts the state on the watch.
          if (mins != null && outstanding >= 0.02 * (r.expectedVote ?? Infinity)) stalledStates.add(st);
          // A top-of-board alert only when the outstanding votes could change the result.
          if (mins != null && outstanding > marginVotes) {
            unitStalls.push({
              severity: outstanding / Math.max(1, marginVotes),
              text: `County count stalled: ${u.name} (${r.name}) — no new votes for ${mins} min at ${Math.round((u.pctExpected ?? 0) * 100)}% in; ~${Math.round(outstanding).toLocaleString()} votes outstanding vs. a ${Math.round(marginVotes).toLocaleString()}-vote statewide margin`,
            });
          }
        }
      }
    }
    const stalled = analyzed
      .filter((r) => r.office !== "house" || watchNow.has(r.state))
      .map((r) => ({ r, mins: stalledMinutes(r, clock.getTime()) }))
      .filter((x): x is { r: Race; mins: number } => x.mins != null);

    for (const { r } of stalled) stalledStates.add(r.state);
    const watch = resolveWatch({ annotations, stalledStates, previous: prevWatch });

    const seq = await nextSeq();
    const notices: string[] = [];
    if (isSimulation()) notices.unshift(`SIMULATION MODE — not real results (sim clock ${simNow(new Date()).toISOString()})`);
    if (gated.size) notices.push(`Pre-close test data ignored for ${[...gated].sort().join(", ")} (polls not closed)`);
    notices.push(...unitStalls.sort((a, b) => b.severity - a.severity).slice(0, 6).map((u) => u.text));
    for (const { r, mins } of stalled.slice(0, 8)) {
      notices.push(`Count stalled: ${r.name} — no new votes for ${mins} min at ${Math.round((r.pctExpected ?? 0) * 100)}% in`);
    }
    for (const f of feeds) if (!f.ok) notices.push(`${f.adapter} (${f.states.join(",")}): ${f.lastError ?? "failed"}`);

    const snapshot: Snapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      seq,
      races: analyzed,
      balance: {
        senate: computeBalance("senate", analyzed, metas, SENATE_NOT_UP_2026),
        house: computeBalance("house", analyzed, metas, { D: 0, R: 0, I: 0 }),
        governor: computeBalance("governor", analyzed, metas, { D: 0, R: 0, I: 0 }),
      },
      feeds,
      notices,
      watch,
    };

    const parsed = SnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      console.error("[ingest] snapshot failed validation", parsed.error.issues.slice(0, 5));
      return { ok: false, error: "snapshot invalid", ms: Date.now() - t0, feeds };
    }

    await writeSnapshot(parsed.data);
    return { ok: true, seq, races: analyzed.length, feeds, ms: Date.now() - t0 };
  } catch (e) {
    console.error("[ingest] fatal", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  } finally {
    await releaseLock();
  }
}

/**
 * House metas carry no turnout baseline, so expected vote would fall back to "votes so far". Approximate each
 * district as an equal share of its state's 2024 presidential turnout (districts are equal-population).
 */
function withHouseTurnout(
  metas: RaceMeta[],
  counties: ReadonlyMap<string, { state: string; turnout2024?: number }>,
): RaceMeta[] {
  const stateTurnout = new Map<string, number>();
  for (const c of counties.values()) stateTurnout.set(c.state, (stateTurnout.get(c.state) ?? 0) + (c.turnout2024 ?? 0));
  const districts = new Map<string, number>();
  for (const m of metas) if (m.office === "house") districts.set(m.state, (districts.get(m.state) ?? 0) + 1);
  return metas.map((m) => {
    if (m.office !== "house" || m.baseline.turnout2024 || m.baseline.turnout2022) return m;
    const st = stateTurnout.get(m.state);
    const n = districts.get(m.state);
    return st && n ? { ...m, baseline: { ...m.baseline, turnout2024: Math.round(st / n) } } : m;
  });
}
