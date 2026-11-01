"use client";

import Link from "next/link";
import type { Party, Race, RaceMeta } from "@/data/schema";
import { Card } from "@/components/ui/card";
import { Pct } from "./num";
import { RatingBadge, StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { RaceFlags } from "./race-flags";
import { annotationsFor } from "@/data/annotations";
import type { PhotoMap } from "@/data/reference/images";
import { Face } from "@/components/race/face";

type LiveRace = Omit<Race, "units"> | Race;
type Cand = { id: string; name: string; party: string; incumbent?: boolean; votes: number; pct: number };
type Flag = NonNullable<Race["flags"]>[number];

/** A race counts as close for the needs tick while the trailer needs at most this share of what is left. */
const NEEDS_CLOSE = 70;
/** Share of the expected vote that must be in before the needs tick appears. */
const NEEDS_MIN_IN = 0.2;

/** Flags that hold a race: the count is paused, in court, or has ballots set aside. Advisories do not. */
const HOLDING: ReadonlySet<Flag["kind"]> = new Set(["count-paused", "litigation", "set-aside"]);

const surname = (name: string) => name.split(" ").filter((p) => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p)).pop() ?? name;
const lastName = (c: { name: string }) => surname(c.name).toLowerCase();
/** Join the last two words so a short line never leaves one orphan word on a second line. */
const keepTail = (s: string) => s.replace(/ (\S+)$/, " $1");

/** The nominee of a party: the vote leader once votes exist, otherwise the incumbent, then the best-documented filer. */
function pick(list: Cand[], party: "D" | "R", counting: boolean): Cand | undefined {
  const side = list.filter((c) => c.party === party);
  if (counting) return [...side].sort((a, b) => b.votes - a.votes)[0];
  const rank = (c: Cand) => (c.incumbent ? 2 : 0) - (!c.incumbent && list.some((o) => o.incumbent && o !== c && lastName(o) === lastName(c)) ? 3 : 0);
  return [...side].sort((a, b) => rank(b) - rank(a))[0];
}

function partyFill(party: string, held: boolean) {
  if (party === "D") return held ? "bg-party-d-muted" : "bg-party-d";
  if (party === "R") return held ? "bg-party-r-muted" : "bg-party-r";
  return held ? "bg-ink-faint" : "bg-party-i";
}

function holdLine(f: Flag): string {
  const t = f.asOf.includes("T")
    ? new Date(f.asOf).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).toLowerCase()
    : null;
  if (f.kind === "count-paused") return t ? `Count paused at ${t}` : "Count paused";
  if (f.kind === "set-aside") return f.challengedBallots ? `Demand to set aside ~${f.challengedBallots.toLocaleString()} ballots` : "Set-aside demand";
  return "In litigation";
}

/**
 * Race card in the Hatch grammar. The bar is the expected vote drawn to scale: [leader][trailer][hatched remainder],
 * so how much is still out is visible rather than implied. In a close race a 3px ink tick inside the hatch marks the
 * share of what is left the trailing candidate needs. A held race (paused count, litigation, set-aside ballots) gets a
 * hazard band on its top edge, muted party colours and an amber status line.
 */
export function RaceCard({
  live,
  meta,
  href,
  photos,
  className,
}: {
  live?: LiveRace;
  meta?: RaceMeta;
  href?: string;
  /** Candidate photos by id; before the count each nominee gets a face, with initials when there is no photo. */
  photos?: PhotoMap;
  className?: string;
}) {
  const title = live?.name ?? meta?.name ?? "Race";
  const counting = !!live && live.totalVotes > 0 && live.candidates.length > 0;
  const field: Cand[] = counting
    ? live!.candidates
    : (meta?.candidates ?? []).map((c) => ({ ...c, votes: 0, pct: 0 }));
  const d = pick(field, "D", counting);
  const r = pick(field, "R", counting);
  const others = field.filter((c) => c !== d && c !== r);
  const leader = counting ? field.find((c) => c.id === live!.leaderId) : undefined;
  const offLane = leader && leader !== d && leader !== r ? leader : undefined;

  const dr = counting ? live!.marginDR : undefined;
  const model = counting ? live!.model : undefined;
  const pctIn = live?.pctExpected;
  const pctFrac = pctIn != null ? (pctIn <= 1 ? pctIn : pctIn / 100) : null;
  const projected = live?.projection;
  const status = live?.status ?? "not_started";
  const called = status === "projected" || status === "certified";

  const flags = live?.flags ?? (meta ? annotationsFor(meta) : undefined);
  const holdFlag = counting && !called ? flags?.find((f) => HOLDING.has(f.kind)) : undefined;
  const held = !!holdFlag;

  const margin = dr == null ? "—" : Math.abs(dr) < 0.05 ? "Even" : `${dr > 0 ? "D" : "R"}+${Math.abs(dr).toFixed(1)}`;
  const marginTone =
    dr == null || Math.abs(dr) < 0.05 || held ? "text-muted-foreground" : dr > 0 ? "text-party-d-ink" : "text-party-r-ink";

  // Expected vote to scale. Without a pct-in estimate, what is counted is all we can draw.
  const total = counting ? live!.totalVotes : 0;
  const ev = counting ? Math.max(total, live!.expectedVote ?? (pctFrac && pctFrac > 0 ? total / pctFrac : total)) : 1;
  const ranked = counting ? [d, r, offLane].filter((c): c is Cand => !!c).sort((a, b) => b.votes - a.votes) : [];
  const shown = ranked.reduce((s, c) => s + c.votes, 0);
  const segs = ranked.map((c) => ({ c, w: c.votes / ev }));
  const restW = counting ? Math.max(0, total - shown) / ev : 0;
  const remainderW = counting ? Math.max(0, 1 - total / ev) : 1;

  // Needs tick: the trailing major-party candidate's required share of the remainder. Only for a close race with
  // enough counted to mean something (early on every trailer "needs 50%"), and only while it is still reachable.
  const trailer = !called && d && r && counting ? (d.votes < r.votes ? d : r) : undefined;
  const needs = trailer ? (trailer.party === "D" ? model?.needsOfRemainingD : model?.needsOfRemainingR) : undefined;
  const showNeeds = trailer && needs != null && needs > 0 && needs <= NEEDS_CLOSE && (pctFrac ?? 0) >= NEEDS_MIN_IN && remainderW > 0.01;
  const remainderStart = 1 - remainderW;

  // Before the first vote there is no margin, bar or status to show: the card is the matchup, the forecast and the polls.
  if (!counting) {
    const poll = meta?.polls;
    const pm = poll ? poll.d - poll.r : undefined;
    const pre = (
      <Card className={cn("h-full gap-4 p-5 transition-colors hover:bg-s2", className)}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate text-lg font-semibold leading-snug">{title}</h3>
          {meta?.ratings.consensus && <RatingBadge rating={meta.ratings.consensus} className="shrink-0" />}
        </div>
        <div className="space-y-3">
          {[d, r].map((c, i) =>
            c ? (
              <div key={c.id} className="flex items-center gap-3">
                <Face name={c.name} party={c.party} photo={photos?.[c.id]} size={44} />
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-base font-semibold leading-snug", c.party === "D" ? "text-party-d-ink" : "text-party-r-ink")}>{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.incumbent ? "Incumbent" : c.party === "D" ? "Democrat" : "Republican"}</div>
                </div>
              </div>
            ) : (
              <div key={i} className="flex min-h-11 items-center text-sm text-muted-foreground">
                No {i === 0 ? "Democratic" : "Republican"} nominee
              </div>
            ),
          )}
        </div>
        {pm == null ? (
          <p className="mt-auto text-sm text-muted-foreground">No public polling average</p>
        ) : (
          <p className="mt-auto text-sm text-muted-foreground">
            Poll average{" "}
            <span className={cn("font-semibold", pm > 0 ? "text-party-d-ink" : pm < 0 ? "text-party-r-ink" : "text-foreground")}>
              {Math.abs(pm) < 0.05 ? "Even" : `${pm > 0 ? "D" : "R"}+${Math.abs(pm).toFixed(1)}`}
            </span>
          </p>
        )}
      </Card>
    );
    return href ? (
      <Link href={href} className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-signal">
        {pre}
      </Link>
    ) : (
      pre
    );
  }

  const body = (
    <Card className={cn("relative h-full gap-3 p-3 transition-colors hover:bg-s2", held && "pt-[22px]", className)}>
      {held && <div aria-hidden className="hazard absolute inset-x-0 top-0 h-2.5" />}
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("min-w-0 truncate text-base font-semibold leading-6", held && "text-muted-foreground")}>{title}</h3>
        <StatusBadge status={status} party={projected?.party} leader={leader?.party as Party | undefined} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-3">
        <Side c={d} counting={counting} winner={projected?.winnerId === d?.id} lead={leader === d} held={held} tone="text-party-d-ink" />
        <span className={cn("fig text-2xl font-semibold leading-none", marginTone)} aria-label={dr == null ? "No margin yet" : `Margin ${margin}`}>
          {margin}
        </span>
        <Side c={r} counting={counting} winner={projected?.winnerId === r?.id} lead={leader === r} held={held} tone="text-party-r-ink" right />
      </div>

      <div
        role="img"
        aria-label={
          counting
            ? `${ranked.map((c) => `${surname(c.name)} ${c.pct.toFixed(1)}%`).join(", ")}; ${Math.round(remainderW * 100)}% of the expected vote still out`
            : "No votes counted yet"
        }
        className="relative"
      >
        <div className="flex h-3.5 w-full overflow-hidden rounded-[2px] bg-s1">
          {segs.map(({ c, w }) => (
            <div key={c.id} className={cn("h-full anim-bar", partyFill(c.party, held))} style={{ width: `${w * 100}%` }} title={c.name} />
          ))}
          {restW > 0 && <div className="h-full bg-ink-faint anim-bar" style={{ width: `${restW * 100}%` }} title="Others" />}
          {remainderW > 0 && <div className="h-full hatch anim-bar" style={{ width: `${remainderW * 100}%` }} title="Still to count" />}
        </div>
        {showNeeds && (
          <div
            aria-hidden
            className="absolute -inset-y-1 w-[3px] -translate-x-1/2 bg-foreground anim-bar"
            style={{ left: `${(remainderStart + (needs! / 100) * remainderW) * 100}%` }}
          />
        )}
      </div>

      {holdFlag ? (
        <p className="text-sm font-semibold text-alert-ink" title={holdFlag.summary}>
          {keepTail(holdLine(holdFlag))}
        </p>
      ) : showNeeds ? (
        <p className="text-sm text-pretty text-foreground">
          {keepTail(`${surname(trailer!.name)} needs ${Math.round(needs!)}% of what is left`)}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted-foreground tnum">
        <span>
          {counting && pctFrac != null ? (
            <>
              <Pct value={pctFrac * 100} digits={0} /> of expected vote in
              {model ? <span title="Model range for the final margin"> · final {fmtRange(model.projectedMarginDR, model.band)}</span> : null}
            </>
          ) : (
            "No votes yet"
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {!holdFlag && <RaceFlags flags={flags} />}
          {meta?.ratings.consensus && <RatingBadge rating={meta.ratings.consensus} />}
        </span>
      </div>

      {(offLane || others.length > 0) && (
        <div className="text-xs text-muted-foreground text-pretty">
          {offLane ? (
            <span>
              <span className="font-medium text-foreground">{offLane.name}</span> ({offLane.party}) leads with{" "}
              <span className="fig">{offLane.pct.toFixed(1)}%</span>
            </span>
          ) : (
            <span>
              Also on the ballot: {others.slice(0, 2).map((c) => surname(c.name)).join(", ")}
              {others.length > 2 ? ` +${others.length - 2}` : ""}
            </span>
          )}
        </div>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function fmtRange(center: number, band: number) {
  const lead = Math.abs(center) < 0.05 ? "Even" : `${center > 0 ? "D" : "R"}+${Math.abs(center).toFixed(1)}`;
  return `${lead} ± ${band.toFixed(1)}`;
}

function Side({
  c,
  counting,
  winner,
  lead,
  held,
  tone,
  right,
}: {
  c?: Cand;
  counting: boolean;
  winner: boolean;
  lead: boolean;
  held: boolean;
  tone: string;
  right?: boolean;
}) {
  if (!c) return <span className={cn("text-sm text-muted-foreground", right && "text-right")}>No nominee</span>;
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      <div className={cn("truncate text-[15px]", held ? "text-muted-foreground" : tone, winner || lead ? "font-bold" : "font-medium")}>
        {surname(c.name)}
        {c.incumbent ? <span className="font-normal text-muted-foreground"> (inc.)</span> : null}
      </div>
      <div className="text-sm text-muted-foreground">{counting ? <Pct value={c.pct} digits={1} /> : " "}</div>
    </div>
  );
}
