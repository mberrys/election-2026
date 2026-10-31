import Link from "next/link";
import { seatsHeld, seatsNeeded } from "@/analytics";
import { Card } from "@/components/ui/card";
import type { BalanceOfPower } from "@/data/schema";
import { cn } from "@/lib/utils";
import { BalanceBar } from "./balance-bar";
import { Num } from "./num";

type Party = "D" | "R";

/** One short "needs" line per party; the last two words are joined so nothing wraps as a lone orphan. */
function needLine(bop: BalanceOfPower, party: Party, uncalled: number, vpParty?: Party, short = false): string {
  const name = short ? (party === "D" ? "Dems" : "GOP") : party === "D" ? "Democrats" : "Republicans";
  const need = seatsNeeded(bop, party, { vpParty });
  if (need === 0) return `${name} have control`;
  if (need > uncalled) return `${name} cannot reach control`;
  return `${name} need ${need} of ${uncalled}`;
}

/**
 * The chamber that decides control gets the screen's one hero figure. Solid numbers are seats secured
 * (not up + won tonight); the bar hatches what is still out, tinted toward the party the rating leans.
 */
export function SenateHero({ bop, href, vpParty }: { bop: BalanceOfPower; href: string; vpParty?: Party }) {
  const uncalled = bop.raceIds?.uncalled.length ?? 0;
  const d = seatsHeld(bop, "D", { vpParty });
  const r = seatsHeld(bop, "R", { vpParty });
  const control = vpParty ? `${bop.majority} to control, or 50 + VP (${vpParty})` : `${bop.majority} to control`;
  return (
    <Card className="gap-5 px-4 py-4 md:px-6 md:py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-xl font-bold">U.S. Senate</h2>
        <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
          Senate board →
        </Link>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-x-4">
        <Figure value={d} party="D" label="Dem + Ind secured" />
        <p className="hidden pb-2 text-center text-sm text-muted-foreground tnum text-pretty sm:block">
          {control}
          <br />
          {uncalled} uncalled · {bop.tossup} toss-up{bop.tossup === 1 ? "" : "s"}
        </p>
        <Figure value={r} party="R" label="GOP secured" right />
      </div>
      <div className="pt-4">
        <BalanceBar bop={bop} height={20} />
      </div>
      <div className="grid gap-x-4 gap-y-1 text-[15px] font-medium sm:grid-cols-2">
        <span className="text-party-d-ink">{needLine(bop, "D", uncalled, vpParty)}</span>
        <span className="text-party-r-ink sm:text-right">{needLine(bop, "R", uncalled, vpParty)}</span>
      </div>
      <p className="text-sm text-muted-foreground tnum sm:hidden">
        {control} · {uncalled} uncalled
      </p>
    </Card>
  );
}

function Figure({ value, party, label, right }: { value: number; party: Party; label: string; right?: boolean }) {
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      <div className={cn("hero-num text-[56px] leading-[0.9] md:text-[80px] xl:text-[96px]", party === "D" ? "text-party-d-ink" : "text-party-r-ink")}>
        <Num value={value} />
      </div>
      <div className="mt-1.5 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Compact chamber row (House, governors): figures at 32–40px in auto-sized columns so three-digit counts
 * never run together or clip at phone width, and a thinner bar.
 */
export function ChamberRow({
  title,
  bop,
  href,
  note,
}: {
  title: string;
  bop: BalanceOfPower;
  href: string;
  /** Replaces the "N to control" summary (governors have no majority). */
  note?: string;
}) {
  const uncalled = bop.raceIds?.uncalled.length ?? 0;
  const d = seatsHeld(bop, "D");
  const r = seatsHeld(bop, "R");
  const hasMajority = bop.majority > 0;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 py-4">
      <Count value={d} party="D" />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Link href={href} className="font-semibold hover:underline underline-offset-4">
            {title}
          </Link>
          <span className="text-sm text-muted-foreground tnum">
            {note ?? (hasMajority ? `${bop.majority} to control` : "")} · {uncalled}&nbsp;uncalled
          </span>
        </div>
        <BalanceBar bop={bop} height={8} showMajorityTick={false} />
        {hasMajority && (
          <div className="flex flex-wrap justify-between gap-x-3 text-sm tnum">
            <span className="text-party-d-ink">{needLine(bop, "D", uncalled, undefined, true)}</span>
            <span className="text-party-r-ink">{needLine(bop, "R", uncalled, undefined, true)}</span>
          </div>
        )}
      </div>
      <Count value={r} party="R" />
    </div>
  );
}

function Count({ value, party }: { value: number; party: Party }) {
  return (
    <div
      className={cn(
        "display min-w-[3ch] text-[32px] font-bold leading-none tnum md:text-[40px]",
        party === "D" ? "text-party-d-ink" : "text-right text-party-r-ink",
      )}
    >
      <Num value={value} />
    </div>
  );
}
