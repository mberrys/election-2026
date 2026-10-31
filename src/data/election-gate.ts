import type { Race, StateMeta } from "./schema";

/**
 * Pre-close gate. Several states publish TEST numbers on their live endpoints before Election Day
 * (AK DoE and CA SoS did on 2026-10-30). Until a state's polls close we zero every count and drop status,
 * so test data can never surface as a lead or a projection.
 *
 * ELECTION_DATE (YYYY-MM-DD, default 2026-11-03) and ALLOW_PRECLOSE_DATA=1 (rehearsals/replays) override.
 */
const ELECTION_DATE = process.env.ELECTION_DATE ?? "2026-11-03";
// Nov 3 2026 is after the DST change (Nov 1), so Eastern = UTC−5.
const ET_OFFSET_HOURS = 5;

/** Last poll close for a state as a UTC Date. "19:00/20:00" → 20:00 ET; "00:00"/"01:00" → after midnight. */
export function pollCloseUtc(state: Pick<StateMeta, "pollCloseEt">, electionDate = ELECTION_DATE): Date {
  const last = state.pollCloseEt.split("/").pop() ?? "20:00";
  const [h, m] = last.split(":").map(Number);
  const base = new Date(`${electionDate}T00:00:00Z`);
  const dayOffset = h < 12 ? 1 : 0; // closes listed as 00:00/01:00 ET belong to the next calendar day
  return new Date(base.getTime() + ((dayOffset * 24 + h + ET_OFFSET_HOURS) * 60 + (m || 0)) * 60_000);
}

export function pollsClosed(state: StateMeta | undefined, now: Date): boolean {
  // The simulator enforces poll-close timing on its own clock.
  // Mirrors isSimulation() (not imported to avoid a cycle): a stray SIMULATE=1 on production must not open the gate.
  const sim =
    process.env.SIMULATE === "1" && (process.env.VERCEL_ENV !== "production" || process.env.SIMULATE_IN_PROD === "1");
  if (process.env.ALLOW_PRECLOSE_DATA === "1" || sim) return true;
  if (!state) return false;
  return now.getTime() >= pollCloseUtc(state).getTime();
}

/** Strip vote counts and any status derived from them; keep candidates and source so the board still lists the race. */
export function zeroRace(race: Race): Race {
  const zeroVotes = (v: Record<string, number>) => Object.fromEntries(Object.keys(v).map((k) => [k, 0]));
  return {
    ...race,
    candidates: race.candidates.map((c) => ({ ...c, votes: 0, pct: 0 })),
    totalVotes: 0,
    precinctsReporting: race.precinctsTotal != null ? 0 : race.precinctsReporting,
    modes: undefined,
    leaderId: undefined,
    marginPts: undefined,
    marginDR: undefined,
    expectedVote: undefined,
    pctExpected: undefined,
    status: "not_started",
    projection: undefined,
    model: undefined,
    units: race.units.map((u) => ({
      ...u,
      votes: zeroVotes(u.votes),
      totalVotes: 0,
      precinctsReporting: u.precinctsTotal != null ? 0 : u.precinctsReporting,
      modes: undefined,
      complete: false,
    })),
  };
}
