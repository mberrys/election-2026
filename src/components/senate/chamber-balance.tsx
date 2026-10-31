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
      <CardContent className="pt-5">
        <div className="flex items-end justify-between gap-4">
          <Side party="D" total={totals.d} won={won.d} notUp={bop.notUp.D + bop.notUp.I} called={bop.called.D + bop.called.I} leaning={bop.leaning.D + bop.leaning.I} />
          <div className="hidden sm:flex flex-col items-center text-center text-xs text-muted-foreground pb-1">
            <span className="display text-base font-semibold text-foreground tracking-wide">U.S. SENATE</span>
            <span className="tnum">{bop.majority} for majority · 50 + VP ({VP_PARTY})</span>
            <span className="tnum">
              {uncalled} uncalled · {bop.tossup} toss-up{bop.tossup === 1 ? "" : "s"}
            </span>
          </div>
          <Side party="R" total={totals.r} won={won.r} notUp={bop.notUp.R} called={bop.called.R} leaning={bop.leaning.R} right />
        </div>

        <div className="mt-6 mb-2">
          <BalanceBar bop={bop} height={22} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Callout party="D" need={needD} uncalled={uncalled} up={upD} target={bop.majority} />
          <Callout party="R" need={needR} uncalled={uncalled} up={upR} target={50} note="with VP tie-break" />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
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
  const color = party === "D" ? "text-party-d" : "text-party-r";
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      <div className={cn("display tnum font-bold leading-none text-6xl sm:text-7xl", color)}>
        <Num value={total} />
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{party === "D" ? "Dem + Ind" : "GOP"}</div>
      <div className={cn("mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tnum", right && "justify-end")}>
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
        "rounded-md border px-3 py-2 text-sm tnum",
        party === "D" ? "border-party-d/40 bg-party-d-faint/30" : "border-party-r/40 bg-party-r-faint/30",
        need === 0 && (party === "D" ? "bg-party-d-faint" : "bg-party-r-faint"),
      )}
    >
      <div className="font-semibold">{text}</div>
      <div className="text-[11px] text-muted-foreground">
        Target {target}
        {note ? ` (${note})` : ""} · {up} of this year&apos;s seats on their side by rating
      </div>
    </div>
  );
}
