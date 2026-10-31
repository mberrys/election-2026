"use client";

import { seatsNeeded } from "@/analytics";
import { BalanceBar } from "@/components/board/balance-bar";
import { Num } from "@/components/board/num";
import { Card, CardContent } from "@/components/ui/card";
import type { BalanceOfPower } from "@/data/schema";
import { cn } from "@/lib/utils";
import { seatTotals, seatsWon } from "./balance";

/** Vice President's party: breaks 50–50 ties, so that side controls the chamber at 50 seats. */
export const VP_PARTY = "R" as const;

export function ChamberBalance({ bop, className }: { bop: BalanceOfPower; className?: string }) {
  const totals = seatTotals(bop);
  const won = seatsWon(bop);
  const uncalled = bop.raceIds?.uncalled.length ?? bop.total - won.d - won.r;
  const needD = seatsNeeded(bop, "D", { vpParty: VP_PARTY });
  const needR = seatsNeeded(bop, "R", { vpParty: VP_PARTY });
  const upD = bop.called.D + bop.called.I + bop.leaning.D + bop.leaning.I;
  const upR = bop.called.R + bop.leaning.R;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <Side party="D" total={totals.d} won={won.d} notUp={bop.notUp.D + bop.notUp.I} called={bop.called.D + bop.called.I} leaning={bop.leaning.D + bop.leaning.I} />
          <div className="hidden flex-col items-center pb-2 text-center text-sm text-muted-foreground md:flex">
            <span className="display text-lg font-bold text-foreground">U.S. Senate</span>
            <span className="tnum">{bop.majority} for majority · 50 + VP ({VP_PARTY})</span>
            <span className="tnum">
              {uncalled} uncalled · {bop.tossup} toss-up{bop.tossup === 1 ? "" : "s"}
            </span>
          </div>
          <Side party="R" total={totals.r} won={won.r} notUp={bop.notUp.R} called={bop.called.R} leaning={bop.leaning.R} right />
        </div>

        <div className="mt-7 mb-2">
          <BalanceBar bop={bop} height={20} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Callout party="D" need={needD} uncalled={uncalled} up={upD} target={bop.majority} />
          <Callout party="R" need={needR} uncalled={uncalled} up={upR} target={50} note="with VP tie-break" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground text-pretty">
          Totals count seats not up this year, seats won tonight, and uncalled seats by consensus rating lean. Independents
          (King, Sanders) are counted with Democrats. Control at 50 goes to the Vice President&apos;s party.
        </p>
      </CardContent>
    </Card>
  );
}

function Side({
  party,
  total,
  won,
  notUp,
  called,
  leaning,
  right,
}: {
  party: "D" | "R";
  total: number;
  won: number;
  notUp: number;
  called: number;
  leaning: number;
  right?: boolean;
}) {
  const color = party === "D" ? "text-party-d-ink" : "text-party-r-ink";
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      {/* The one hero number on this screen: Archivo at 125% width, 56px on phones up to 96px. */}
      <div className={cn("hero-num text-[56px] leading-[0.9] sm:text-[80px] lg:text-[96px]", color)}>
        <Num value={total} />
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{party === "D" ? "Dem + Ind" : "GOP"}</div>
      <div className={cn("mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground tnum", right && "justify-end")}>
        <span>
          <b className="text-foreground">{notUp}</b> not up
        </span>
        <span>
          <b className={color}>{called}</b> won
        </span>
        <span>
          <b className="text-foreground">{leaning}</b> leaning
        </span>
        <span className="sr-only">{won} secured</span>
      </div>
    </div>
  );
}

function Callout({
  party,
  need,
  uncalled,
  up,
  target,
  note,
}: {
  party: "D" | "R";
  need: number;
  uncalled: number;
  up: number;
  target: number;
  note?: string;
}) {
  const label = party === "D" ? "Dems" : "GOP";
  const feasible = need <= uncalled;
  const text =
    need === 0
      ? `${label} have ${target}: control secured`
      : feasible
        ? `${label} need ${need} of ${uncalled} uncalled`
        : `${label} cannot reach ${target} (need ${need}, ${uncalled} left)`;
  return (
    <div
      className={cn(
        "rounded-[3px] border-l-4 bg-s1 px-3 py-2 text-sm tnum",
        party === "D" ? "border-l-party-d" : "border-l-party-r",
        need === 0 && (party === "D" ? "bg-party-d text-on-party" : "bg-party-r text-on-party"),
      )}
    >
      <div className="font-semibold text-pretty">{text}</div>
      <div className={cn("text-xs", need === 0 ? "text-on-party/80" : "text-muted-foreground")}>
        Target {target}
        {note ? ` (${note})` : ""} · {up} of this year&apos;s seats on their side by rating
      </div>
    </div>
  );
}
