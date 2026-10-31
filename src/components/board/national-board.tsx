"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { indexRaces, useNational, useSlowReference } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { BalanceBar } from "./balance-bar";
import { RaceCard } from "./race-card";
import { IntegrityWatch } from "./integrity-watch";
import { Num } from "./num";
import { TierBadge } from "./status-badge";
import { HexCartogram, HEXMAP_ATTRIBUTION } from "@/components/maps/hex-cartogram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BalanceOfPower, Race, RaceMeta, StateMeta } from "@/data/schema";
import { RATING_LEAN, RATING_ORDER } from "@/data/schema";
import { fmtEt, fmtMarginDR } from "@/lib/format";
import { computeBalance, SENATE_NOT_UP_2026 } from "@/analytics";
import { cn } from "@/lib/utils";

import type { PollsRef } from "@/data/reference/load";
type Polls = PollsRef | null | undefined;
type LiveRace = Omit<Race, "units">;

export function NationalBoard({ metas, states, polls }: { metas: RaceMeta[]; states: StateMeta[]; polls?: Polls }) {
  const mounted = useMounted();
  const { data } = useNational();
  const live = useMemo(() => indexRaces(mounted ? data : undefined), [data, mounted]);
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas]);
  const stateByAbbr = useMemo(() => new Map(states.map((s) => [s.abbr, s])), [states]);

  // Pre-election balance from ratings alone, so the board is meaningful before any votes arrive.
  const balance = useMemo(() => {
    if (mounted && data?.balance) return data.balance;
    return {
      senate: computeBalance("senate", [], metas, SENATE_NOT_UP_2026),
      house: computeBalance("house", [], metas, { D: 0, R: 0, I: 0 }),
      governor: computeBalance("governor", [], metas, { D: 0, R: 0, I: 0 }),
    };
  }, [data, metas, mounted]);

  const keyRaces = useMemo(() => {
    const score = (m: RaceMeta) => {
      const r = m.ratings.consensus ?? "tossup";
      const d = Math.abs(RATING_ORDER.indexOf(r) - 4); // 0 = tossup
      const officeW = m.office === "senate" ? 0 : m.office === "governor" ? 0.5 : 1;
      return d * 10 + officeW;
    };
    return metas
      .filter((m) => m.office !== "ballot" && m.office !== "stateleg")
      .filter((m) => {
        const r = m.ratings.consensus;
        return !r || RATING_LEAN[r] === "tossup" || r.startsWith("tilt") || r.startsWith("lean");
      })
      .sort((a, b) => score(a) - score(b) || a.state.localeCompare(b.state))
      .slice(0, 18);
  }, [metas]);

  const { data: slow } = useSlowReference();
  const genericBallot = useMemo(() => {
    if (mounted && slow?.generic) return slow.generic;
    const g = polls?.generic;
    if (g?.riotimes) return { d: g.riotimes.d, r: g.riotimes.r, source: "Rio Times 5-average" };
    if (g?.votehub) return { d: g.votehub.d, r: g.votehub.r, source: "VoteHub" };
    return null;
  }, [polls, slow, mounted]);

  return (
    <div className="space-y-6">
      {/* Balance of power */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_minmax(260px,0.6fr)]">
        <BopCard title="U.S. Senate" bop={balance.senate} live={mounted && !!data?.balance} href="/senate" />
        <BopCard title="U.S. House" bop={balance.house} live={mounted && !!data?.balance} href="/house" />
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Governors · Generic ballot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <GovStrip bop={balance.governor} />
            {genericBallot ? (
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-party-d font-semibold tnum">D {genericBallot.d.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">{fmtMarginDR(genericBallot.d - genericBallot.r)} · {genericBallot.source}</span>
                  <span className="text-party-r font-semibold tnum">R {genericBallot.r.toFixed(1)}</span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-sm bg-uncalled/40">
                  <div className="bg-party-d" style={{ width: `${genericBallot.d}%` }} />
                  <div className="flex-1" />
                  <div className="bg-party-r" style={{ width: `${genericBallot.r}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Generic ballot average unavailable.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <IntegrityWatch metas={metas} states={states} live={live} payload={mounted ? data : undefined} />

      {/* Key races */}
      <section>
        <SectionTitle title="Key races" sub="Toss-ups and leaners by consensus rating (Cook · Inside Elections · Sabato)" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {keyRaces.map((m) => {
            const lr = live.get(m.id);
            return (
              <RaceCard
                key={m.id}
                meta={m}
                live={lr}
                href={`/state/${m.state}`}
                className="h-full"
              />
            );
          })}
        </div>
      </section>

      {/* Cartogram + poll-closing timeline */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="gap-3">
          <CardHeader className="pb-0 flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">House · all 435 districts</CardTitle>
            <Link href="/house" className="text-xs text-muted-foreground hover:text-foreground">
              Open House board →
            </Link>
          </CardHeader>
          <CardContent>
            <HouseCartogram metaById={metaById} live={live} />
            <p className="mt-2 text-[10px] text-muted-foreground">{HEXMAP_ATTRIBUTION}</p>
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Poll closings · Tuesday Nov 3 (ET)</CardTitle>
          </CardHeader>
          <CardContent>
            <PollCloseTimeline states={states} metas={metas} live={live} />
          </CardContent>
        </Card>
      </section>

      {/* Feeds */}
      {mounted && data?.feeds?.length ? (
        <section>
          <SectionTitle title="Data feeds" sub="Official state and county sources polled every minute" />
          <div className="flex flex-wrap gap-2">
            {data.feeds.map((f) => (
              <div
                key={f.adapter}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                  f.ok ? "border-border/60" : "border-destructive/50 text-destructive",
                )}
                title={f.lastError ?? undefined}
              >
                <TierBadge tier={f.tier} />
                <span className="font-medium">{f.states.join(" ")}</span>
                <span className="text-muted-foreground tnum">{f.racesUpdated} races</span>
                {f.latencyMs != null && <span className="text-muted-foreground tnum">{f.latencyMs}ms</span>}
              </div>
            ))}
          </div>
          {data.notices.length > 0 && (
            <ul className="mt-2 text-xs text-stale space-y-1">
              {data.notices.map((n, i) => (
                <li key={i}>⚠ {n}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {!stateByAbbr.size && <Skeleton className="h-10" />}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="display text-2xl font-bold tracking-tight">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BopCard({ title, bop, live, href }: { title: string; bop: BalanceOfPower; live: boolean; href: string }) {
  const d = bop.notUp.D + bop.notUp.I + bop.called.D + bop.called.I;
  const r = bop.notUp.R + bop.called.R;
  const dLean = bop.leaning.D + bop.leaning.I;
  const rLean = bop.leaning.R;
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0 flex-row items-center justify-between">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          Details →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between mb-3">
          <Big n={d} lean={dLean} label="Dem seats (held + won)" className="text-party-d" />
          <div className="text-center text-[11px] text-muted-foreground leading-tight">
            <div className="tnum">
              <span className="text-foreground font-semibold">{bop.majority}</span> to control
            </div>
            <div className="tnum">{bop.tossup} toss-ups</div>
            {live && <div className="tnum">{(bop.raceIds?.uncalled.length ?? 0)} uncalled</div>}
          </div>
          <Big n={r} lean={rLean} label="GOP seats (held + won)" className="text-party-r" right />
        </div>
        <BalanceBar bop={bop} height={18} />
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground tnum">
          <span>+{dLean} leaning</span>
          <span>+{rLean} leaning</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Big({ n, lean, label, className, right }: { n: number; lean: number; label: string; className?: string; right?: boolean }) {
  return (
    <div className={right ? "text-right" : ""}>
      <div className={cn("display text-5xl font-bold leading-none", className)}>
        <Num value={n} />
        {lean > 0 && <span className="text-xl text-muted-foreground font-medium"> +{lean}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function GovStrip({ bop }: { bop: BalanceOfPower }) {
  const d = bop.called.D + bop.called.I + bop.leaning.D + bop.leaning.I;
  const r = bop.called.R + bop.leaning.R;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-party-d font-semibold tnum">{d}</span>
        <span className="text-xs text-muted-foreground">36 governorships · {bop.tossup} toss-ups</span>
        <span className="text-party-r font-semibold tnum">{r}</span>
      </div>
      <BalanceBar bop={bop} height={8} showMajorityTick={false} className="mt-1" />
    </div>
  );
}

function HouseCartogram({ metaById, live }: { metaById: Map<string, RaceMeta>; live: Map<string, LiveRace> }) {
  const [mode, setMode] = useState<"status" | "ratings">("status");
  const fill = (id: string): string | null => {
    const lr = live.get(id);
    const meta = metaById.get(id);
    if (mode === "status" && lr?.projection) return lr.projection.party === "D" ? "var(--party-d)" : lr.projection.party === "R" ? "var(--party-r)" : "var(--party-i)";
    const r = meta?.ratings.consensus;
    if (!r) return null;
    const lean = RATING_LEAN[r];
    if (lean === "tossup") return "var(--uncalled)";
    const strong = r.startsWith("solid") || r.startsWith("likely");
    if (mode === "ratings") return lean === "D" ? (strong ? "var(--party-d)" : "var(--party-d-soft)") : strong ? "var(--party-r)" : "var(--party-r-soft)";
    return lean === "D" ? "var(--party-d-faint)" : "var(--party-r-faint)";
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <ToggleGroup value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as typeof mode)} className="gap-1">
          <ToggleGroupItem value="status" className="h-7 px-2 text-xs">
            Results
          </ToggleGroupItem>
          <ToggleGroupItem value="ratings" className="h-7 px-2 text-xs">
            Ratings
          </ToggleGroupItem>
        </ToggleGroup>
        <Legend />
      </div>
      <HexCartogram fill={fill} label={(id) => metaById.get(id)?.name ?? id} showLabels={false} />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-party-d inline-block" /> D</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-party-d-faint inline-block" /> Lean D</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-uncalled inline-block" /> Toss-up</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-party-r-faint inline-block" /> Lean R</span>
      <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-party-r inline-block" /> R</span>
    </div>
  );
}

function PollCloseTimeline({ states, metas, live }: { states: StateMeta[]; metas: RaceMeta[]; live: Map<string, LiveRace> }) {
  const groups = useMemo(() => {
    const competitiveStates = new Map<string, number>();
    for (const m of metas) {
      const r = m.ratings.consensus;
      if (m.office === "ballot" || m.office === "stateleg") continue;
      if (!r || RATING_LEAN[r] === "tossup" || r.startsWith("tilt") || r.startsWith("lean")) {
        competitiveStates.set(m.state, (competitiveStates.get(m.state) ?? 0) + 1);
      }
    }
    const byTime = new Map<string, StateMeta[]>();
    for (const s of states) {
      const t = s.pollCloseEt.split("/").pop() ?? s.pollCloseEt;
      byTime.set(t, [...(byTime.get(t) ?? []), s]);
    }
    return [...byTime.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([t, sts]) => ({ t, states: sts.sort((a, b) => a.abbr.localeCompare(b.abbr)), competitive: competitiveStates }));
  }, [states, metas]);

  const counted = (abbr: string) => [...live.values()].some((r) => r.state === abbr && r.totalVotes > 0);

  return (
    <ol className="space-y-2">
      {groups.map((g) => (
        <li key={g.t} className="grid grid-cols-[72px_1fr] gap-2 items-start">
          <div className="text-sm font-semibold tnum pt-0.5">{fmtEt(g.t)}</div>
          <div className="flex flex-wrap gap-1">
            {g.states.map((s) => {
              const n = g.competitive.get(s.abbr) ?? 0;
              return (
                <Link
                  key={s.abbr}
                  href={`/state/${s.abbr}`}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs tnum border transition-colors",
                    n > 0 ? "border-foreground/30 font-semibold" : "border-border/60 text-muted-foreground",
                    counted(s.abbr) && "bg-live/15 border-live/50",
                  )}
                  title={n ? `${s.name}: ${n} competitive race${n > 1 ? "s" : ""}` : s.name}
                >
                  {s.abbr}
                  {n > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{n}</span>}
                </Link>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
