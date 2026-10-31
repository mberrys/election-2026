import type { Race } from "@/data/schema";
import { cn } from "@/lib/utils";

type Flag = NonNullable<Race["flags"]>[number];

const LABEL: Record<Flag["kind"], string> = {
  litigation: "Litigation",
  "set-aside": "Ballots set aside",
  "count-paused": "Count paused",
  advisory: "Advisory",
};

/** Small chips for litigation / set-aside ballots. Full text in the title tooltip; link to the source. */
export function RaceFlags({ flags, className, detailed = false }: { flags?: Flag[]; className?: string; detailed?: boolean }) {
  if (!flags?.length) return null;
  if (detailed) {
    return (
      <ul className={cn("space-y-1.5", className)}>
        {flags.map((f, i) => (
          <li key={i} className="rounded-md border border-stale/40 bg-stale/10 px-3 py-2 text-xs">
            <span className="font-semibold text-stale">{LABEL[f.kind]}</span>
            {f.challengedBallots ? <span className="tnum text-stale"> · ~{f.challengedBallots.toLocaleString()} ballots</span> : null}
            <span className="text-muted-foreground"> — {f.summary} </span>
            {f.url && (
              <a href={f.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                Source ({f.asOf})
              </a>
            )}
            {f.challengedBallots ? (
              <div className="mt-1 text-[11px] text-muted-foreground">
                We will not project a winner whose lead is smaller than this pool.
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <span className={cn("inline-flex gap-1", className)}>
      {flags.map((f, i) => (
        <span
          key={i}
          title={`${LABEL[f.kind]}: ${f.summary}${f.challengedBallots ? ` (~${f.challengedBallots.toLocaleString()} ballots)` : ""}`}
          className="inline-flex items-center rounded border border-stale/50 px-1 py-px text-[10px] font-medium text-stale"
        >
          {LABEL[f.kind]}
        </span>
      ))}
    </span>
  );
}
