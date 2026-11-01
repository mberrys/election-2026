"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { expectedStateMargin, uncertaintyBand } from "@/analytics";
import type { CandidateResult, Party, Race, RaceMeta } from "@/data/schema";
import { Card } from "@/components/ui/card";
import { MarginDR, Num, NumberFlowGroup, Pct, Votes } from "@/components/board/num";
import { RatingBadge, StatusBadge } from "@/components/board/status-badge";
import { RaceFlags } from "@/components/board/race-flags";
import { annotationsFor } from "@/data/annotations";
import { compact, fmtMarginDR, fmtPct, nf0, partyLabel, partyName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { shortDate } from "./state-content";

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

const partyInk = (p: Party) => (p === "D" ? "text-party-d-ink" : p === "R" ? "text-party-r-ink" : "text-muted-foreground");

/**
 * The selected race. Before any vote is counted it shows who is running, the consensus rating, the polling average
 * and the pre-election expectation; vote totals, shares, % in and needs-of-remaining appear once votes exist.
 */
export function TopLine({ race, meta }: { race?: Race; meta?: RaceMeta }) {
  const cands = useMemo(() => candidateList(race, meta), [race, meta]);
  const isBallot = (race?.office ?? meta?.office) === "ballot";
  const hasVotes = (race?.totalVotes ?? 0) > 0;
  const pctIn = race?.pctExpected;
  const winnerId = race?.projection?.winnerId;
  const leaderId = race?.leaderId;
  const d = topOfParty(cands, "D");
  const r = topOfParty(cands, "R");
  const model = race?.model;
  const polls = meta?.polls;
  const pollShare = (p: Party) => (polls ? (p === "D" ? polls.d : p === "R" ? polls.r : undefined) : undefined);

  // Pre-election: show the prior (polls → rating → last race → 2024) as the needle, with the widest band.
  const preMargin = expectedStateMargin(meta);
  const gaugeMargin = model?.projectedMarginDR ?? preMargin;
  const gaugeBand = model?.band ?? uncertaintyBand(0);
  const gaugeLive = !!model;

  const big = cands.slice(0, 2);
  const rest = cands.slice(2);

  return (
    <Card className="gap-6 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h2 className="section-title">{race?.name ?? meta?.name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {hasVotes && pctIn != null && (
              <span className="tnum">
                <Pct value={pctIn * 100} digits={0} className="font-semibold text-foreground" /> of expected vote in
              </span>
            )}
            {hasVotes && race?.marginPts != null && leaderId ? (
              <span className="tnum">
                Leader ahead by <Pct value={race.marginPts} className="font-semibold text-foreground" />
              </span>
            ) : hasVotes && race?.marginDR != null ? (
              <span className="tnum">
                <MarginDR value={race.marginDR} />
              </span>
            ) : null}
            {!hasVotes && meta?.ratings.consensus && !isBallot && <RatingBadge rating={meta.ratings.consensus} className="text-sm" />}
            {!hasVotes && polls && (
              <span className="tnum" title={`${polls.source} · ${polls.n} polls · as of ${polls.asOf}`}>
                Polling average <span className="font-semibold text-foreground">{fmtMarginDR(polls.d - polls.r)}</span>
                {` (${polls.n} poll${polls.n === 1 ? "" : "s"}${shortDate(polls.asOf) ? `, through ${shortDate(polls.asOf)}` : ""})`}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={race?.status ?? "not_started"} party={race?.projection?.party} />
      </div>

      <RaceFlags detailed flags={race?.flags ?? (meta ? annotationsFor(meta) : undefined)} />

      {isBallot && !cands.length ? (
        <p className="text-[15px] text-muted-foreground">{meta?.notes ?? "Ballot measure. Yes/no totals appear once the count reports them."}</p>
      ) : (
        <NumberFlowGroup>
          <ul className="grid gap-3 sm:grid-cols-2">
            {big.map((c) => {
              const isWinner = c.id === winnerId;
              const isLeader = hasVotes && !winnerId && c.id === leaderId;
              const share = pollShare(c.party);
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    isWinner || isLeader ? "border-foreground/30 bg-accent/30" : "border-border",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn("truncate text-lg leading-snug", isWinner || isLeader ? "font-bold" : "font-semibold")}>
                        {c.name}
                        {isWinner && <span className="sr-only"> (projected winner)</span>}
                      </div>
                      <div className="text-xs">
                        <span className={partyInk(c.party)}>{partyName[c.party]}</span>
                        {c.incumbent && <span className="text-muted-foreground"> · Incumbent</span>}
                      </div>
                    </div>
                    {!hasVotes && share != null && (
                      <div className="shrink-0 text-right">
                        <div className="tnum text-lg font-semibold">{fmtPct(share)}</div>
                        <div className="text-xs text-muted-foreground">in polls</div>
                      </div>
                    )}
                  </div>
                  {hasVotes && (
                    <>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <Votes value={c.votes} className="display text-4xl font-bold leading-none md:text-5xl" />
                        <Pct value={c.pct} className={cn("display text-3xl font-semibold leading-none", partyInk(c.party))} />
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-s3">
                        <div
                          className={cn("h-full transition-[width] duration-700", c.party === "D" ? "bg-party-d" : c.party === "R" ? "bg-party-r" : "bg-party-i")}
                          style={{ width: `${Math.min(100, c.pct)}%` }}
                        />
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {rest.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Also running:{" "}
              {rest.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <span className="text-foreground">{c.name}</span> ({partyLabel[c.party]})
                  {hasVotes && (
                    <>
                      {" "}
                      <Pct value={c.pct} className="text-foreground" />
                    </>
                  )}
                </span>
              ))}
            </p>
          )}
        </NumberFlowGroup>
      )}

      {!isBallot && (
        <div className={cn("grid gap-4", gaugeLive && "lg:grid-cols-[1fr_auto] lg:items-center")}>
          <ProjectionGauge margin={gaugeMargin} band={gaugeBand} live={gaugeLive} />
          {gaugeLive && (
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[18rem] lg:grid-cols-1">
              <NeedsCallout cand={d} party="D" share={model?.needsOfRemainingD} remaining={model?.remainingVotes} />
              <NeedsCallout cand={r} party="R" share={model?.needsOfRemainingR} remaining={model?.remainingVotes} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const GAUGE_W = 640;
const GAUGE_H = 44;
const PAD = 28;
const RANGE = 15;
const xOf = (m: number) => PAD + ((RANGE - Math.max(-RANGE, Math.min(RANGE, m))) / (2 * RANGE)) * (GAUGE_W - 2 * PAD);
const TICKS = [15, 10, 5, 0, -5, -10, -15];

/**
 * Needle from D+15 (left) to R+15 (right) with a translucent ± band. Explicitly labelled as model output.
 * Tick labels are HTML under the SVG so they stay at 13px however narrow the gauge renders.
 */
export function ProjectionGauge({ margin, band, live, className }: { margin: number; band: number; live: boolean; className?: string }) {
  const x = xOf(margin);
  const x0 = xOf(margin + band);
  const x1 = xOf(margin - band);
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted-foreground">
        <span>{live ? "Projected final margin" : "Pre-election expectation"}</span>
        <span className="tnum">
          <span className="font-semibold text-foreground">{fmtMarginDR(margin)}</span> ± {band.toFixed(1)}
          <span className="text-xs"> · {live ? "model, not a call" : "from polls and ratings, not a call"}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} className="h-auto w-full" role="img" aria-label={`Projected margin ${fmtMarginDR(margin)} plus or minus ${band.toFixed(1)} points`}>
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
        {TICKS.map((t) => (
          <line key={t} x1={xOf(t)} x2={xOf(t)} y1={34} y2={t === 0 ? 44 : 40} stroke="var(--muted-foreground)" strokeWidth={t === 0 ? 1.5 : 1} />
        ))}
        <motion.g initial={false} animate={{ x }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
          <polygon points="0,16 -7,4 7,4" fill="var(--foreground)" />
          <line y1={14} y2={44} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />
        </motion.g>
      </svg>
      <div className="relative mt-1 h-5 text-xs text-muted-foreground tnum" aria-hidden>
        {TICKS.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(xOf(t) / GAUGE_W) * 100}%` }}>
            {t === 0 ? "Even" : t > 0 ? `D+${t}` : `R+${-t}`}
          </span>
        ))}
      </div>
    </div>
  );
}

function NeedsCallout({ cand, party, share, remaining }: { cand?: Cand; party: Party; share?: number; remaining?: number }) {
  const name = cand ? lastName(cand.name) : partyLabel[party];
  let body: React.ReactNode;
  if (share == null || remaining == null) return null;
  if (remaining <= 0 && share <= 0) body = <span>has the votes; nothing left to count</span>;
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
    <div className="rounded-md border border-border/70 px-3 py-2 text-sm leading-snug">
      <span className={cn("font-semibold", partyInk(party))}>{name}</span> {body}
    </div>
  );
}
