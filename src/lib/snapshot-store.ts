import { getRedis } from "./redis";
import type { NationalPayload, Race, Snapshot } from "@/data/schema";

/**
 * Snapshot storage.
 *  snap:national      compact payload (races without units)         ← /api/results
 *  snap:state:{ST}    full races for one state, with county units   ← /api/results?scope=state:NC
 *  snap:race:{id}     full single race                              ← /api/results?scope=race:senate:GA
 *  snap:seq           ingest counter
 *  snap:history       list of {seq, generatedAt, balance} (ring, 720 entries ≈ 12h at 1/min)
 *  ingest:lock        short TTL lock so overlapping triggers don't double-run
 *
 * Without Redis (local dev) everything lives in module memory.
 */

const mem = new Map<string, unknown>();
const KEY = {
  national: "snap:national",
  state: (st: string) => `snap:state:${st.toUpperCase()}`,
  race: (id: string) => `snap:race:${id}`,
  seq: "snap:seq",
  history: "snap:history",
  lock: "ingest:lock",
  slow: "ref:slow",
};

async function setJson(key: string, value: unknown, ttlSec?: number) {
  const r = getRedis();
  if (!r) {
    mem.set(key, value);
    return;
  }
  await r.set(key, JSON.stringify(value), ttlSec ? { ex: ttlSec } : undefined);
}

async function getJson<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return (mem.get(key) as T) ?? null;
  const v = await r.get<string | T>(key);
  if (v == null) return null;
  return typeof v === "string" ? (JSON.parse(v) as T) : (v as T);
}

export async function nextSeq(): Promise<number> {
  const r = getRedis();
  if (!r) {
    const n = ((mem.get(KEY.seq) as number) ?? 0) + 1;
    mem.set(KEY.seq, n);
    return n;
  }
  return r.incr(KEY.seq);
}

/** Try to take the ingest lock. Returns false if another run holds it. */
export async function acquireLock(ttlSec = 110): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    const until = (mem.get(KEY.lock) as number) ?? 0;
    if (until > Date.now()) return false;
    mem.set(KEY.lock, Date.now() + ttlSec * 1000);
    return true;
  }
  const ok = await r.set(KEY.lock, Date.now(), { nx: true, ex: ttlSec });
  return ok === "OK";
}

export async function releaseLock() {
  const r = getRedis();
  if (!r) {
    mem.delete(KEY.lock);
    return;
  }
  await r.del(KEY.lock);
}

export async function writeSnapshot(snapshot: Snapshot) {
  const national: NationalPayload = {
    ...snapshot,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    races: snapshot.races.map(({ units, ...rest }) => rest),
  };
  const byState = new Map<string, Race[]>();
  for (const race of snapshot.races) {
    const list = byState.get(race.state) ?? [];
    list.push(race);
    byState.set(race.state, list);
  }

  const r = getRedis();
  if (!r) {
    mem.set(KEY.national, national);
    for (const [st, races] of byState) mem.set(KEY.state(st), { generatedAt: snapshot.generatedAt, seq: snapshot.seq, races });
    for (const race of snapshot.races) mem.set(KEY.race(race.id), race);
    const hist = ((mem.get(KEY.history) as unknown[]) ?? []).concat([
      { seq: snapshot.seq, generatedAt: snapshot.generatedAt, balance: snapshot.balance },
    ]);
    mem.set(KEY.history, hist.slice(-720));
    return;
  }

  const p = r.pipeline();
  p.set(KEY.national, JSON.stringify(national));
  for (const [st, races] of byState) {
    p.set(KEY.state(st), JSON.stringify({ generatedAt: snapshot.generatedAt, seq: snapshot.seq, races }));
  }
  // Only key races get their own key to bound write volume (senate/governor + house units present).
  for (const race of snapshot.races) {
    if (race.office !== "house" || race.units.length > 0) p.set(KEY.race(race.id), JSON.stringify(race));
  }
  p.rpush(KEY.history, JSON.stringify({ seq: snapshot.seq, generatedAt: snapshot.generatedAt, balance: snapshot.balance }));
  p.ltrim(KEY.history, -720, -1);
  await p.exec();
}

export const readNational = () => getJson<NationalPayload>(KEY.national);
export const readState = (st: string) =>
  getJson<{ generatedAt: string; seq: number; races: Race[] }>(KEY.state(st));
export const readRace = (id: string) => getJson<Race>(KEY.race(id));

export async function readHistory(limit = 720) {
  const r = getRedis();
  if (!r) return ((mem.get(KEY.history) as unknown[]) ?? []).slice(-limit);
  const rows = await r.lrange<string>(KEY.history, -limit, -1);
  return rows.map((row) => (typeof row === "string" ? JSON.parse(row) : row));
}

/** Slow-lane reference refresh (ratings/polls/money) stored as a blob keyed by name. */
export const writeSlow = (name: string, value: unknown) => setJson(`${KEY.slow}:${name}`, value);
export const readSlow = <T>(name: string) => getJson<T>(`${KEY.slow}:${name}`);
