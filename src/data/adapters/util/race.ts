import type { CandidateResult, Office, Race, RaceStatus, ReportingUnit, VoteModes } from "../../schema";
import type { AdapterCtx } from "../types";

/**
 * Shared race assembly: dedupes candidate ids (several write-in rows collapse
 * to one), computes totals, percentages, leader, margins and a conservative
 * status (`not_started` | `counting` | `certified`). Projections are never set
 * here — that is the ingest's call rule.
 */

export interface AssembleInput {
  id: string;
  office: Office;
  state: string;
  district?: string;
  special?: boolean;
  name: string;
  candidates: CandidateResult[];
  units?: ReportingUnit[];
  precinctsReporting?: number;
  precinctsTotal?: number;
  modes?: VoteModes;
  certified?: boolean;
  source: { adapter: string; tier: "A" | "B" | "C"; url?: string; attribution?: string };
  ctx: Pick<AdapterCtx, "now">;
}

export function assembleRace(input: AssembleInput): Race {
  const byId = new Map<string, CandidateResult>();
  for (const c of input.candidates) {
    const prev = byId.get(c.id);
    if (prev) prev.votes += c.votes;
    else byId.set(c.id, { ...c });
  }
  const candidates = [...byId.values()];
  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
  for (const c of candidates) c.pct = totalVotes > 0 ? round2((c.votes / totalVotes) * 100) : 0;
  candidates.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

  const leader = totalVotes > 0 ? candidates[0] : undefined;
  const runnerUp = totalVotes > 0 ? candidates[1] : undefined;
  const marginPts = leader ? round2(leader.pct - (runnerUp?.pct ?? 0)) : undefined;
  const d = candidates.find((c) => c.party === "D");
  const r = candidates.find((c) => c.party === "R");
  const marginDR = totalVotes > 0 && (d || r) ? round2((d?.pct ?? 0) - (r?.pct ?? 0)) : undefined;

  const units = (input.units ?? []).map((u) => ({
    ...u,
    margin: unitMargin(u, d?.id, r?.id),
  }));

  let status: RaceStatus = "counting";
  if (input.certified) status = "certified";
  else if (totalVotes === 0 && (input.precinctsReporting ?? 0) === 0) status = "not_started";

  const modes = input.modes && hasAnyMode(input.modes) ? input.modes : undefined;
  const now = input.ctx.now.toISOString();

  return {
    id: input.id,
    office: input.office,
    state: input.state,
    ...(input.district ? { district: input.district } : {}),
    special: input.special ?? false,
    name: input.name,
    candidates,
    totalVotes,
    ...(input.precinctsReporting !== undefined ? { precinctsReporting: input.precinctsReporting } : {}),
    ...(input.precinctsTotal !== undefined ? { precinctsTotal: input.precinctsTotal } : {}),
    ...(modes ? { modes } : {}),
    ...(leader ? { leaderId: leader.id } : {}),
    ...(marginPts !== undefined ? { marginPts } : {}),
    ...(marginDR !== undefined ? { marginDR } : {}),
    status,
    units,
    source: { ...input.source, fetchedAt: now },
    updatedAt: now,
  };
}

function unitMargin(u: ReportingUnit, dId?: string, rId?: string): number | undefined {
  if (u.totalVotes <= 0) return undefined;
  const dv = dId ? (u.votes[dId] ?? 0) : 0;
  const rv = rId ? (u.votes[rId] ?? 0) : 0;
  return round2(((dv - rv) / u.totalVotes) * 100);
}

export function hasAnyMode(m: VoteModes): boolean {
  return (m.early ?? 0) + (m.mail ?? 0) + (m.electionDay ?? 0) + (m.provisional ?? 0) > 0;
}

export function addModes(a: VoteModes | undefined, b: VoteModes | undefined): VoteModes | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: VoteModes = {};
  for (const k of ["early", "mail", "electionDay", "provisional"] as const) {
    const v = (a[k] ?? 0) + (b[k] ?? 0);
    if (a[k] !== undefined || b[k] !== undefined) out[k] = v;
  }
  return out;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build a ReportingUnit from candidateId → votes, computing the total. */
export function makeUnit(
  base: Omit<ReportingUnit, "votes" | "totalVotes" | "level"> & { level?: ReportingUnit["level"] },
  votes: Record<string, number>,
): ReportingUnit {
  const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0);
  const u: ReportingUnit = { ...base, level: base.level ?? "county", votes, totalVotes };
  if (u.precinctsTotal !== undefined && u.precinctsReporting !== undefined && u.precinctsTotal > 0) {
    u.complete = u.precinctsReporting >= u.precinctsTotal;
  }
  return u;
}
