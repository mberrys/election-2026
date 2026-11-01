"use client";

import { raceHref } from "@/lib/race-slug";
import Link from "next/link";
import { useMemo, useState } from "react";
import { indexRaces, useNational, useSlowReference } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { RaceCard } from "./race-card";
import { selectKeyRaces } from "./key-races";
import type { PhotoMap } from "@/data/reference/images";
import { ChamberRow, SenateHero } from "./control-lanes";
import { Swatch } from "./hatch";
import { VP_PARTY } from "@/components/senate/chamber-balance";
import { TierBadge } from "./status-badge";
import { HEX_HATCH, HEX_HATCH_D, HEX_HATCH_R, HexCartogram, HEXMAP_ATTRIBUTION } from "@/components/maps/hex-cartogram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BalanceOfPower, Race, RaceMeta, StateMeta } from "@/data/schema";
import { RATING_LEAN } from "@/data/schema";
import { fmtEt, fmtMarginDR, partyColorVar } from "@/lib/format";
import { computeBalance, seatsHeld, seatsNeeded, SENATE_NOT_UP_2026 } from "@/analytics";
import { cn } from "@/lib/utils";

import type { PollsRef } from "@/data/reference/load";
type Polls = PollsRef | null | undefined;
type LiveRace = Omit<Race, "units">;

export function NationalBoard({ metas, states, polls, photos }: { metas: RaceMeta[]; states: StateMeta[]; polls?: Polls; photos?: PhotoMap }) {
  const mounted = useMounted();
  const { data } = useNational();
  const live = useMemo(() => indexRaces(mounted ? data : undefined), [data, mounted]);
  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas]);
  const stateByAbbr = useMemo(() => new Map(states.map((s) => [s.abbr, s])), [states]);

  // Pre-election balance from ratings alone, so the board is meaningful before any votes arrive.
  const balance = useMemo(() => {
    if (mounted && data?.balance && data.races.length) return data.balance;
    return {
      senate: computeBalance("senate", [], metas, SENATE_NOT_UP_2026),
      house: computeBalance("house", [], metas, { D: 0, R: 0, I: 0 }),
      governor: computeBalance("governor", [], metas, { D: 0, R: 0, I: 0 }),
    };
  }, [data, metas, mounted]);

  const keyRaces = useMemo(() => selectKeyRaces(metas), [metas]);

  const { data: slow } = useSlowReference();
  const genericBallot = useMemo(() => {
    if (mounted && slow?.generic) return slow.generic;
    const g = polls?.generic;
    if (g?.riotimes) return { d: g.riotimes.d, r: g.riotimes.r, source: "Rio Times 5-average" };
    if (g?.votehub) return { d: g.votehub.d, r: g.votehub.r, source: "VoteHub" };
    return null;
  }, [polls, slow, mounted]);

  const counting = mounted && !!data?.races.some((r) => r.totalVotes > 0);
  const finding = useMemo(() => nightFinding(balance.senate, counting), [balance, counting]);

  return (
    <div className="space-y-12">
      <header className="max-w-3xl space-y-2">
        <h1 className="page-title">{counting ? "Election night" : "2026 midterms"}</h1>
        <p className="text-lg text-pretty text-foreground md:text-xl">{finding}</p>
      </header>

      {/* Balance of power: the Senate decides control and gets the hero figure; House and governors are compact rows. */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SenateHero bop={balance.senate} href="/senate" vpParty={VP_PARTY} />
        <Card className="gap-0 divide-y divide-border px-4 py-1 md:px-5">
          <ChamberRow title="U.S. House" bop={balance.house} href="/house" />
          <ChamberRow title="Governors" bop={balance.governor} href="/governors" note={`${balance.governor.total} races`} />
          <div className="space-y-2 py-4">
            {genericBallot ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold">Generic ballot</span>
                  <span className="text-muted-foreground">
                    <span className="fig">{fmtMarginDR(genericBallot.d - genericBallot.r)}</span> · {genericBallot.source}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="fig font-semibold text-party-d-ink">D {genericBallot.d.toFixed(1)}</span>
                  <div className="flex h-2 flex-1 overflow-hidden rounded-[2px] bg-s3">
                    <div className="bg-party-d anim-bar" style={{ width: `${genericBallot.d}%` }} />
                    <div className="flex-1" />
                    <div className="bg-party-r anim-bar" style={{ width: `${genericBallot.r}%` }} />
                  </div>
                  <span className="fig font-semibold text-party-r-ink">R {genericBallot.r.toFixed(1)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Generic ballot average unavailable.</p>
            )}
          </div>
        </Card>
      </section>

      {/* Key races */}
      <section>
        <SectionTitle title="Key races" sub="The closest contests by the consensus of Cook, Inside Elections and Sabato. Pick one for the campaigns, polls and news." />
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {keyRaces.map((m) => (
            <RaceCard key={m.id} meta={m} live={live.get(m.id)} href={raceHref(m.id)} photos={photos} className="h-full" />
          ))}
        </div>
      </section>

      {/* Cartogram + poll-closing timeline */}
      <section className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="gap-3">
          <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-x-3 pb-0">
            <CardTitle>House, all 435 districts</CardTitle>
            <Link href="/house" className="text-sm text-muted-foreground hover:text-foreground">
              House board →
            </Link>
          </CardHeader>
          <CardContent>
            <HouseCartogram metaById={metaById} live={live} counting={counting} />
            <p className="mt-2 text-xs text-muted-foreground">{HEXMAP_ATTRIBUTION}</p>
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardTitle>Poll closings, Tuesday Nov 3</CardTitle>
          </CardHeader>
          <CardContent>
            <PollCloseTimeline states={states} metas={metas} live={live} />
          </CardContent>
        </Card>
      </section>

      {/* Feeds */}
      {counting && data?.feeds?.length ? (
        <section>
          <SectionTitle title="Data feeds" sub="Official state and county sources polled every minute" />
          <div className="flex flex-wrap gap-2">
            {data.feeds.map((f) => (
              <div
                key={f.adapter}
                className={cn(
                  "flex items-center gap-2 rounded-[3px] border px-2.5 py-1.5 text-sm",
                  f.ok ? "border-border" : "border-alert text-alert-ink",
                )}
                title={f.lastError ?? undefined}
              >
                <TierBadge tier={f.tier} />
                <span className="font-medium">{f.states.join(" ")}</span>
                <span className="text-muted-foreground tnum">{f.racesUpdated} races</span>
                {f.latencyMs != null && <span className="fig text-muted-foreground">{f.latencyMs}ms</span>}
              </div>
            ))}
          </div>
          {data.notices.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {data.notices.map((n, i) => (
                <li key={i}>{n}</li>
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
    <div className="mb-5 space-y-1.5">
      <h2 className="section-title">{title}</h2>
      {sub && <p className="text-[15px] text-muted-foreground text-pretty">{sub}</p>}
    </div>
  );
}

function HouseCartogram({ metaById, live, counting }: { metaById: Map<string, RaceMeta>; live: Map<string, LiveRace>; counting: boolean }) {
  const [picked, setMode] = useState<"status" | "ratings">("status");
  // Before any votes, "results" would only restate the ratings with hatching: show the ratings plainly.
  const mode = counting ? picked : "ratings";
  const leaderParty = (lr: LiveRace | undefined) =>
    lr && lr.status === "counting" && lr.totalVotes > 0 ? lr.candidates.find((c) => c.id === lr.leaderId)?.party : undefined;
  const fill = (id: string): string | null => {
    const lr = live.get(id);
    const meta = metaById.get(id);
    if (mode === "status" && lr?.projection) return partyColorVar(lr.projection.party);
    const lead = mode === "status" ? leaderParty(lr) : undefined;
    if (lead === "D") return "var(--party-d-tint)";
    if (lead === "R") return "var(--party-r-tint)";
    const r = meta?.ratings.consensus;
    if (!r) return null;
    const lean = RATING_LEAN[r];
    if (lean === "tossup") return mode === "ratings" ? "var(--s4)" : HEX_HATCH;
    if (mode === "ratings") {
      const step = r.startsWith("solid") ? 4 : r.startsWith("likely") ? 3 : r.startsWith("lean") ? 2 : 1;
      return `var(--ramp-${lean === "D" ? "d" : "r"}-${step})`;
    }
    // Status mode: uncalled stays hatched, the hatch tinted toward the rating's party.
    return lean === "D" ? HEX_HATCH_D : HEX_HATCH_R;
  };
  // Leading = full-colour dot on the tint; a flipped seat keeps the old holder's colour as a top marker.
  const mark = (id: string) => {
    if (mode !== "status") return null;
    const lr = live.get(id);
    const lead = leaderParty(lr);
    const held = metaById.get(id)?.heldBy;
    const won = lr?.projection?.party;
    const flipFrom = won && held && won !== held ? partyColorVar(held) : undefined;
    const dot = lead ? partyColorVar(lead) : undefined;
    return dot || flipFrom ? { dot, flipFrom } : null;
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {counting ? (
          <ToggleGroup value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as typeof mode)} className="gap-1">
            <ToggleGroupItem value="status">Results</ToggleGroupItem>
            <ToggleGroupItem value="ratings">Ratings</ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <p className="text-[15px] text-muted-foreground">Coloured by forecast rating</p>
        )}
        <Legend mode={mode} />
      </div>
      <HexCartogram fill={fill} mark={mark} label={(id) => metaById.get(id)?.name ?? id} showLabels={false} />
    </div>
  );
}

function Legend({ mode }: { mode: "status" | "ratings" }) {
  const item = "flex items-center gap-1.5";
  if (mode === "ratings")
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className={item}>
          <Swatch kind="ramp-d-4" /> Solid D
        </span>
        <span className={item}>
          <Swatch kind="ramp-d-2" /> Lean D
        </span>
        <span className={item}>
          <span className="inline-block size-3 rounded-[2px] bg-s4" /> Toss-up
        </span>
        <span className={item}>
          <Swatch kind="ramp-r-2" /> Lean R
        </span>
        <span className={item}>
          <Swatch kind="ramp-r-4" /> Solid R
        </span>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className={item}>
        <Swatch kind="projected-d" />
        <Swatch kind="projected-r" /> Projected
      </span>
      <span className={item}>
        <Swatch kind="leading-d" />
        <Swatch kind="leading-r" /> Leads
      </span>
      <span className={item}>
        <Swatch kind="lean-d" />
        <Swatch kind="lean-r" /> Uncalled, by rating
      </span>
      <span className={item}>
        <Swatch kind="uncounted" /> Toss-up
      </span>
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
    <div className="space-y-4">
      <ol className="divide-y divide-border">
        {groups.map((g) => (
          <li key={g.t} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-4 py-3">
            <div className="text-[15px] font-bold tnum">{fmtEt(g.t).replace(" ET", "")}</div>
            <p className="text-[15px] leading-relaxed">
              {g.states.map((s, i) => {
                const n = g.competitive.get(s.abbr) ?? 0;
                return (
                  <span key={s.abbr}>
                    {i > 0 && <span className="text-muted-foreground">, </span>}
                    <Link
                      href={`/state/${s.abbr}`}
                      className={cn("underline-offset-4 hover:underline", n > 0 ? "font-semibold text-foreground" : "text-muted-foreground", counted(s.abbr) && "text-signal-ink")}
                      title={n ? `${s.name}: ${n} competitive race${n > 1 ? "s" : ""}` : s.name}
                    >
                      {s.name}
                    </Link>
                  </span>
                );
              })}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        Times are Eastern. States in bold have a competitive race.{" "}
        <Link href="/election-night" className="font-semibold text-foreground underline-offset-4 hover:underline">
          Full schedule
        </Link>
      </p>
    </div>
  );
}

/**
 * The night's main fact in one sentence, from the Senate balance the board already has: who needs how many of the
 * seats still out. Before any votes the pool is the seats on the ballot; once counting starts, the uncalled ones.
 */
function nightFinding(bop: BalanceOfPower, counting: boolean): string {
  const uncalled = bop.raceIds?.uncalled.length ?? 0;
  const needD = seatsNeeded(bop, "D", { vpParty: VP_PARTY });
  const needR = seatsNeeded(bop, "R", { vpParty: VP_PARTY });
  // At exactly 50 seats the Vice President's party controls on the tie-break. The finding's last two words share a
  // non-breaking space so the sentence never ends on a lone word.
  const vpNote = (p: "D" | "R") => (VP_PARTY === p && seatsHeld(bop, p) === 50 ? " with the Vice President's tie-break" : "");
  if (needD === 0) return `Democrats have secured control of the Senate${vpNote("D")}.`;
  if (needR === 0) return `Republicans have secured control of the Senate${vpNote("R")}.`;
  if (!uncalled) return "The Senate balance will fill in as polls close.";
  const pool = counting ? `${uncalled} uncalled Senate seats` : `${uncalled} Senate seats on the ballot`;
  if (needD > uncalled) return `Republicans need ${needR} of the ${pool} for control; Democrats can no longer reach a majority.`;
  if (needR > uncalled) return `Democrats need ${needD} of the ${pool} for control; Republicans can no longer reach 50.`;
  return `Democrats need ${needD} of the ${pool} for control; Republicans need ${needR}.`;
}
