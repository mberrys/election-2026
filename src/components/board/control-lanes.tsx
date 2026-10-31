import Link from "next/link";
import { seatsNeeded } from "@/analytics";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { BalanceOfPower } from "@/data/schema";
import { cn } from "@/lib/utils";
import { Num } from "./num";

type Party = "D" | "R";

/**
 * Balance of power as two lanes to the same finish line. Each lane is one party's road to control:
 * solid = seats secured (not up + called), pale = uncalled seats that lean its way by rating, and the
 * empty remainder is what it still lacks. The tick is the control line, so "who is closer, and by how
 * much" reads as a gap, and the unsettled part is never folded into the headline number.
 */
export function ControlLanes({
  title,
  bop,
  href,
  vpParty,
}: {
  title: string;
  bop: BalanceOfPower;
  href: string;
  /** The Vice President's party breaks a 50-50 Senate tie, so it controls at 50. */
  vpParty?: Party;
}) {
  const uncalled = bop.raceIds?.uncalled.length ?? 0;
  const summary = `${vpParty ? "50 + VP" : `${bop.majority} to control`} · ${uncalled} uncalled · ${bop.tossup} toss-up${bop.tossup === 1 ? "" : "s"}`;
  return (
    <Card className="gap-3">
      <div className="flex items-baseline justify-between gap-2 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          Details →
        </Link>
      </div>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground tnum">{summary}</p>
        <Lane party="D" bop={bop} vpParty={vpParty} uncalled={uncalled} />
        <Lane party="R" bop={bop} vpParty={vpParty} uncalled={uncalled} />
      </CardContent>
    </Card>
  );
}

function Lane({ party, bop, vpParty, uncalled }: { party: Party; bop: BalanceOfPower; vpParty?: Party; uncalled: number }) {
  const d = party === "D";
  const have = d ? bop.notUp.D + bop.notUp.I + bop.called.D + bop.called.I : bop.notUp.R + bop.called.R;
  const lean = d ? bop.leaning.D + bop.leaning.I : bop.leaning.R;
  const target = vpParty === party ? 50 : bop.majority;
  const need = seatsNeeded(bop, party, { vpParty });
  const scale = Math.max(target, have + lean, 1);
  const pct = (n: number) => `${(100 * n) / scale}%`;
  const name = d ? "Democrats" : "Republicans";
  return (
    <div className="grid grid-cols-[3.25rem_1fr] items-center gap-x-3">
      <div className={cn("display text-4xl font-bold leading-none tnum", d ? "text-party-d-ink" : "text-party-r-ink")}>
        <Num value={have} />
      </div>
      <div>
        <div
          role="img"
          aria-label={`${name}: ${have} secured, ${lean} leaning, ${target} needed for control`}
          className="relative flex h-3.5 overflow-hidden rounded-sm bg-uncalled/30"
        >
          <div className={d ? "bg-party-d" : "bg-party-r"} style={{ width: pct(have) }} />
          <div className={d ? "bg-party-d-soft" : "bg-party-r-soft"} style={{ width: pct(lean) }} />
        </div>
        <div className="relative h-0" aria-hidden>
          <span className="absolute top-[-0.875rem] h-3.5 w-0.5 bg-foreground" style={{ left: `calc(${pct(target)} - 1px)` }} />
        </div>
        <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground tnum">
          <span>
            {name} · +{lean} leaning
          </span>
          <span className={cn(need === 0 && "font-semibold text-foreground")}>
            {need === 0 ? "control secured" : `need ${need} of ${uncalled} open`}
          </span>
        </div>
      </div>
    </div>
  );
}
