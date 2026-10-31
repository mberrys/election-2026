"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { expectedStateMargin, uncertaintyBand } from "@/analytics";
import type { CandidateResult, Party, Race, RaceMeta } from "@/data/schema";
import { Card } from "@/components/ui/card";
import { MarginDR, Num, NumberFlowGroup, Pct, Votes } from "@/components/board/num";
import { PartyDot, RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { RaceFlags } from "@/components/board/race-flags";
import { BBStamp } from "@/components/board/hatch";
import { annotationsFor } from "@/data/annotations";
import { compact, fmtMarginDR, fmtPct, nf0, partyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Cand = CandidateResult & { incumbent?: boolean };

const PARTY_RANK: Record<Party, number> = { D: 0, R: 1, I: 2, L: 3, G: 4, O: 5 };

/** Votes desc; ties (pre-count zeros) break toward the major parties so D/R hold the two big slots. */
function candidateList(race: Race | undefined, meta: RaceMeta | undefined): Cand[] {
  const incumbentOf = new Map((meta?.candidates ?? []).map((c) => [c.id, c.incumbent]));
  const list: Cand[] = race?.candidates.length
    ? race.candidates.map((c) => ({ ...c, incumbent: c.incumbent ?? incumbentOf.get(c.id) }))
    : (meta?.candidates ?? []).map((c) => ({ id: c.id, name: c.name, party: c.party, votes: 0, pct: 0, incumbent: c.incumbent }));
  return list.sort((a, b) => b.votes - a.votes || PARTY_RANK[a.party] - PARTY_RANK[b.party] || a.name.localeCompare(b.name));
}

function topOfParty(cands: Cand[], party: Party): Cand | undefined {
  return cands.find((c) => c.party === party);
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last) && parts.length > 1 ? parts[parts.length - 2] : last;
}

/** Candidates, animated totals, % in, leader margin, status, projection gauge and needs-of-remaining callouts. */
export function TopLine({ race, meta }: { race?: Race; meta?: RaceMeta }) {
  const cands = useMemo(() => candidateList(race, meta), [race, meta]);
  const isBallot = (race?.office ?? meta?.office) === "ballot";
  const pctIn = race?.pctExpected;
  const winnerId = race?.projection?.winnerId;
  const leaderId = race?.leaderId;
  const d = topOfParty(cands, "D");
  const r = topOfParty(cands, "R");
  const model = race?.model;

  // Pre-election: show the prior (polls → rating → last race → 2024) as the needle, with the widest band.
  const preMargin = expectedStateMargin(meta);
  const gaugeMargin = model?.projectedMarginDR ?? preMargin;
  const gaugeBand = model?.band ?? uncertaintyBand(0);
  const gaugeLive = !!model;

  const big = cands.slice(0, 2);
  const rest = cands.slice(2);

  return (
    <Card className="p-4 md:p-5 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display text-2xl font-semibold leading-tight">{race?.name ?? meta?.name ?? "—"}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {pctIn != null ? (
              <span className="tnum">
                <Pct value={pctIn * 100} digits={0} className="text-foreground font-medium" /> of expected vote in
              </span>
            ) : (
              <span>No votes reported</span>
            )}
            {race?.marginPts != null && leaderId ? (
              <span className="tnum">
                · leads by <Pct value={race.marginPts} className="text-foreground font-medium" />
              </span>
            ) : race?.marginDR != null ? (
              <span className="tnum">
                · <MarginDR value={race.marginDR} />
              </span>
            ) : null}
            {meta?.ratings.consensus && !isBallot && <RatingBadge rating={meta.ratings.consensus} />}
            {meta?.polls && !race?.candidates.length && (
              <span className="tnum" title={`${meta.polls.source} · ${meta.polls.n} polls · as of ${meta.polls.asOf}`}>
                · Polls D {fmtPct(meta.polls.d)} / R {fmtPct(meta.polls.r)} ({fmtMarginDR(meta.polls.d - meta.polls.r)})
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={race?.status ?? "not_started"} party={race?.projection?.party} />
      </div>

      <RaceFlags detailed flags={race?.flags ?? (meta ? annotationsFor(meta) : undefined)} />

      {isBallot && !cands.length ? (
        <p className="text-sm text-muted-foreground">{meta?.notes ?? "Ballot measure. Yes/no totals appear once the feed reports them."}</p>
      ) : (
        <NumberFlowGroup>
          <ul className="grid gap-3 sm:grid-cols-2">
            {big.map((c) => {
              const isWinner = c.id === winnerId;
              const isLeader = !winnerId && c.id === leaderId;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "relative overflow-hidden rounded-lg border p-3 transition-colors",
                    isWinner || isLeader ? "border-foreground/25 bg-accent/30" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <PartyDot party={c.party} />
                    <span className={cn("truncate font-medium", (isWinner || isLeader) && "font-semibold")}>
                      {c.name}
                      {c.incumbent ? <span className="text-muted-foreground"> *</span> : null}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{partyLabel[c.party]}</span>
                    {isWinner && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                        <BBStamp party={c.party === "D" || c.party === "R" ? c.party : "I"} />
                        Projected · Big Board
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <Votes value={c.votes} className="display text-4xl md:text-5xl font-bold leading-none" />
                    <Pct value={c.pct} className={cn("display text-3xl font-semibold leading-none", c.party === "D" ? "text-party-d-ink" : c.party === "R" ? "text-party-r-ink" : "text-party-i")} />
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-uncalled/30">
                    <div
                      className={cn("h-full transition-[width] duration-700", c.party === "D" ? "bg-party-d" : c.party === "R" ? "bg-party-r" : "bg-party-i")}
                      style={{ width: `${Math.min(100, c.pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {rest.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {rest.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <PartyDot party={c.party} />
                  <span>{c.name}</span>
                  <Votes value={c.votes} className="tnum" />
                  <Pct value={c.pct} className="tnum" />
                </li>
              ))}
            </ul>
          )}
        </NumberFlowGroup>
      )}

      {!isBallot && (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <ProjectionGauge margin={gaugeMargin} band={gaugeBand} live={gaugeLive} />
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1 lg:min-w-[18rem]">
            <NeedsCallout cand={d} party="D" share={model?.needsOfRemainingD} remaining={model?.remainingVotes} />
            <NeedsCallout cand={r} party="R" share={model?.needsOfRemainingR} remaining={model?.remainingVotes} />
          </div>
        </div>
      )}
    </Card>
  );
}

const GAUGE_W = 640;
const GAUGE_H = 64;
const PAD = 28;
const RANGE = 15;
const xOf = (m: number) => PAD + ((RANGE - Math.max(-RANGE, Math.min(RANGE, m))) / (2 * RANGE)) * (GAUGE_W - 2 * PAD);

/** Needle from D+15 (left) to R+15 (right) with a translucent ± band. Explicitly labelled as model output. */
export function ProjectionGauge({ margin, band, live, className }: { margin: number; band: number; live: boolean; className?: string }) {
  const x = xOf(margin);
  const x0 = xOf(margin + band);
  const x1 = xOf(margin - band);
  const ticks = [15, 10, 5, 0, -5, -10, -15];
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>{live ? "Projected final margin" : "Pre-election expectation"}</span>
        <span className="tnum">
          <span className="font-semibold text-foreground">{fmtMarginDR(margin)}</span> ± {band.toFixed(1)} ·{" "}
          <span className="italic">{live ? "model, not a call" : "polls & ratings, not a call"}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} className="w-full h-auto" role="img" aria-label={`Projected margin ${fmtMarginDR(margin)} plus or minus ${band.toFixed(1)} points`}>
        <defs>
          <linearGradient id="gauge-track" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--party-d)" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="var(--uncalled)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--party-r)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect x={PAD} y={24} width={GAUGE_W - 2 * PAD} height={10} rx={5} fill="url(#gauge-track)" />
        <motion.rect
          initial={false}
          animate={{ x: Math.min(x0, x1), width: Math.max(2, Math.abs(x1 - x0)) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          y={18}
          height={22}
          rx={4}
          fill="var(--foreground)"
          fillOpacity={0.18}
          stroke="var(--foreground)"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
        {ticks.map((t) => (
          <g key={t} transform={`translate(${xOf(t)} 0)`}>
            <line y1={34} y2={t === 0 ? 44 : 40} stroke="var(--muted-foreground)" strokeWidth={t === 0 ? 1.5 : 1} />
            <text y={56} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="tnum">
              {t === 0 ? "Even" : t > 0 ? `D+${t}` : `R+${-t}`}
            </text>
          </g>
        ))}
        <motion.g initial={false} animate={{ x }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
          <polygon points="0,16 -7,4 7,4" fill="var(--foreground)" />
          <line y1={14} y2={44} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />
        </motion.g>
      </svg>
    </div>
  );
}

function NeedsCallout({ cand, party, share, remaining }: { cand?: Cand; party: Party; share?: number; remaining?: number }) {
  const name = cand ? lastName(cand.name) : partyLabel[party];
  const color = party === "D" ? "text-party-d-ink" : "text-party-r-ink";
  let body: React.ReactNode;
  if (share == null || remaining == null) body = <span className="text-muted-foreground">Needs-of-remaining appears once votes report.</span>;
  else if (remaining <= 0 && share <= 0) body = <span>has the votes; nothing left to count</span>;
  else if (share > 100) body = <span className="text-muted-foreground">cannot catch up with the remaining vote</span>;
  else if (share < 0) body = <span>has it locked: leads by more than what remains</span>;
  else
    body = (
      <span>
        needs <Num value={share} format={{ maximumFractionDigits: 0 }} suffix="%" className="font-semibold text-foreground" /> of remaining ≈{" "}
        <span className="tnum font-semibold text-foreground" title={`${nf0.format(Math.round((share / 100) * remaining))} of ${nf0.format(remaining)} remaining`}>
          {compact.format(Math.round((share / 100) * remaining))}
        </span>{" "}
        votes
      </span>
    );
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-sm leading-snug">
      <PartyDot party={party} className="mt-1.5" />
      <div>
        <span className={cn("font-semibold", color)}>{name}</span> {body}
      </div>
    </div>
  );
}
