"use client";

import { useQuery } from "@tanstack/react-query";
import type { BalanceOfPower, NationalPayload, Race } from "@/data/schema";

const POLL_MS = 25_000;
// Random jitter only in the browser: Math.random() during the static prerender fails the build under Cache Components.
const jitter = () => (typeof window === "undefined" ? POLL_MS : POLL_MS + Math.round((Math.random() - 0.5) * 8_000));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function useNational(initialData?: NationalPayload) {
  return useQuery({
    queryKey: ["results", "national"],
    queryFn: () => getJson<NationalPayload>("/api/results"),
    refetchInterval: jitter,
    initialData,
  });
}

export type StatePayload = { generatedAt: string | null; seq: number; races: Race[] };

export function useStateResults(state: string) {
  return useQuery({
    queryKey: ["results", "state", state.toUpperCase()],
    queryFn: () => getJson<StatePayload>(`/api/results?scope=state:${state.toUpperCase()}`),
    refetchInterval: jitter,
  });
}

export function useRace(id: string) {
  return useQuery({
    queryKey: ["results", "race", id],
    queryFn: () => getJson<Race>(`/api/results?scope=race:${encodeURIComponent(id)}`),
    refetchInterval: jitter,
  });
}

export type HistoryRow = {
  seq: number;
  generatedAt: string;
  balance: { senate: BalanceOfPower; house: BalanceOfPower; governor: BalanceOfPower };
};

export function useHistory() {
  return useQuery({
    queryKey: ["results", "history"],
    queryFn: () => getJson<{ rows: HistoryRow[] }>("/api/results?scope=history"),
    refetchInterval: 60_000,
  });
}

/** Index the national payload by race id for O(1) lookups in tables. */
export function indexRaces(payload: NationalPayload | undefined) {
  const map = new Map<string, Omit<Race, "units">>();
  if (payload) for (const r of payload.races) map.set(r.id, r);
  return map;
}

export type SlowReference = {
  generic: { d: number; r: number; margin: number; asOf?: string; source: string; fetchedAt: string } | null;
};

/** Slow-lane context (generic ballot) refreshed every 30 min by /api/ingest-slow. */
export function useSlowReference() {
  return useQuery({
    queryKey: ["reference", "slow"],
    queryFn: () => getJson<SlowReference>("/api/reference"),
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });
}
