"use client";

import { seatsNeeded } from "@/analytics";
import { BalanceBar } from "@/components/board/balance-bar";
import { Num } from "@/components/board/num";
import { Card, CardContent } from "@/components/ui/card";
import type { BalanceOfPower } from "@/data/schema";
import { cn } from "@/lib/utils";
import { seatTotals } from "./balance";
import { SeatBar } from "./seat-bar";

/** Vice President's party: breaks 50–50 ties, so that side controls the chamber at 50 seats. */
export const VP_PARTY = "R" as const;

export function ChamberBalance({ bop, className }: { bop: BalanceOfPower; className?: string }) {
  const totals = seatTotals(bop);
  const calledD = bop.called.D + bop.called.I;
  const calledR = bop.called.R;
  const anyCalled = calledD + calledR > 0;
  const uncalled = bop.raceIds?.uncalled.length ?? bop.total - totals.d - totals.r;
  const pool = anyCalled ? `${uncalled} uncalled seat${uncalled === 1 ? "" : "s"}` : `${uncalled} seats up`;

  return (
    <Card className={className}>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6">
          <HeroCount party="D" total={totals.d} label="Democrats and independents" />
          <HeroCount party="R" total={totals.r} label="Republicans" right />
        </div>

        <div className="mt-6">
          {anyCalled ? (
            <BalanceBar bop={bop} height={16} />
          ) : (
            <SeatBar d={totals.d} r={totals.r} total={bop.total} majority={bop.majority} majorityLabel={`${bop.majority} for control`} />
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
          <Need party="D" need={seatsNeeded(bop, "D", { vpParty: VP_PARTY })} pool={pool} uncalled={uncalled} target={bop.majority} />
          <Need party="R" need={seatsNeeded(bop, "R", { vpParty: VP_PARTY })} pool={pool} uncalled={uncalled} target={50} vp right />
        </div>

        {anyCalled && (
          <p className="mt-3 text-xs text-muted-foreground tnum">
            Won tonight: <b className="text-party-d-ink">{calledD}</b> Democratic, <b className="text-party-r-ink">{calledR}</b> Republican
          </p>
        )}

        <p className="mt-5 text-xs text-muted-foreground text-pretty">
          Each total is seats not up this year ({bop.notUp.D + bop.notUp.I} and {bop.notUp.R}) plus {anyCalled ? "seats won tonight and " : ""}
          uncalled races rated toward that side; {bop.tossup} toss-up{bop.tossup === 1 ? " is" : "s are"} left out. Independents King and
          Sanders count with Democrats.
        </p>
      </CardContent>
    </Card>
  );
}

/** Big seat count with its party label underneath. Shared with the Governors hero. */
export function HeroCount({ party, total, label, right }: { party: "D" | "R"; total: number; label: string; right?: boolean }) {
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      {/* The one hero number on this screen: Archivo at 125% width, 56px on phones up to 96px. */}
      <div className={cn("hero-num text-[56px] leading-[0.9] sm:text-[80px] lg:text-[96px]", party === "D" ? "text-party-d-ink" : "text-party-r-ink")}>
        <Num value={total} />
      </div>
      <div className="mt-2 text-sm font-semibold">{label}</div>
    </div>
  );
}

/** One sentence per side: how many more seats it needs, out of what is still open. */
function Need({
  party,
  need,
  pool,
  uncalled,
  target,
  vp,
  right,
}: {
  party: "D" | "R";
  need: number;
  pool: string;
  uncalled: number;
  target: number;
  vp?: boolean;
  right?: boolean;
}) {
  const who = party === "D" ? "Democrats" : "Republicans";
  const ink = party === "D" ? "text-party-d-ink" : "text-party-r-ink";
  const tie = vp ? ", with the Vice President's tie-break" : "";
  const text =
    need === 0 ? (
      <>
        <b className={ink}>{who} have control</b> with {target} seats{tie}.
      </>
    ) : need > uncalled ? (
      <>
        <b className={ink}>{who} cannot reach {target}:</b> they need {need} and only {uncalled} seats are left.
      </>
    ) : (
      <>
        <b className={ink}>
          {who} need {need}
        </b>{" "}
        of the {pool} to reach {target}
        {tie}.
      </>
    );
  return <p className={cn("text-pretty tnum", right && "sm:text-right")}>{text}</p>;
}
