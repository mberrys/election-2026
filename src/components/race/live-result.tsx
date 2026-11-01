"use client";

import { useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("en-US");

/**
 * The count for one race or measure, from the national payload the header already polls (no extra request).
 * Before any votes it is a single quiet line; once counting it shows each line with its share and a bar.
 */
export function LiveResult({ raceId, pollClose, measure = false }: { raceId: string; pollClose: string; measure?: boolean }) {
  const mounted = useMounted();
  const { data } = useNational();
  const race = mounted ? data?.races.find((r) => r.id === raceId) : undefined;
  const counting = !!race && race.totalVotes > 0 && race.candidates.length > 0;

  if (!counting) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-5">
        <p className="text-base font-semibold">Results</p>
        <p className="mt-1 text-[15px] text-ink-muted">The count appears here after polls close at {pollClose}.</p>
      </div>
    );
  }

  const rows = [...race.candidates].sort((a, b) => b.votes - a.votes).slice(0, measure ? 2 : 3);
  const pct = race.pctExpected == null ? undefined : race.pctExpected <= 1 ? race.pctExpected * 100 : race.pctExpected;
  const winner = race.projection?.winnerId;
  const fill = (party: string, name: string) => {
    if (measure) return /^(yes|for)\b/i.test(name) ? "var(--signal)" : "var(--ink-faint)";
    return party === "D" ? "var(--party-d)" : party === "R" ? "var(--party-r)" : "var(--party-i)";
  };

  return (
    <section aria-label="Results" className="space-y-5 rounded-lg border border-border bg-card px-6 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-xl font-bold">{race.status === "projected" ? "Projected result" : "Results so far"}</h2>
        <p className="text-[15px] text-ink-muted tnum">
          {pct != null ? `${Math.round(pct)}% of the expected vote counted` : `${fmt.format(race.totalVotes)} votes counted`}
        </p>
      </div>
      <ul className="space-y-4">
        {rows.map((c) => (
          <li key={c.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className={cn("text-lg", c.id === winner ? "font-bold" : "font-semibold")}>
                {c.name}
                {c.id === winner && <span className="ml-2 text-[15px] font-semibold text-signal-ink">Projected winner</span>}
              </span>
              <span className="flex items-baseline gap-3 tnum">
                <span className="text-[15px] text-ink-muted">{fmt.format(c.votes)}</span>
                <span className="fig text-lg font-semibold">{c.pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-s3">
              <div className="anim-bar h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, background: fill(c.party, c.name) }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
