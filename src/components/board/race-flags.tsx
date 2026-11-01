import type { Race } from "@/data/schema";
import { cn } from "@/lib/utils";

type Flag = NonNullable<Race["flags"]>[number];

const LABEL: Record<Flag["kind"], string> = {
  litigation: "Litigation",
  "set-aside": "Set-aside demand",
  "count-paused": "Count paused",
  advisory: "Advisory",
};

/** Chips for paused counts, litigation and set-aside demands (amber). A challenge is context, not a finding: each says where it stands. */
export function RaceFlags({ flags, className, detailed = false }: { flags?: Flag[]; className?: string; detailed?: boolean }) {
  if (!flags?.length) return null;
  if (detailed) {
    return (
      <ul className={cn("space-y-1.5", className)}>
        {flags.map((f, i) => (
          <li key={i} className="overflow-hidden rounded-[3px] border border-hairline bg-s2 text-sm">
            <div aria-hidden className="hazard h-2.5" />
            <div className="px-3 py-2">
              <span className="font-semibold text-alert-ink">{LABEL[f.kind]}</span>
              {f.challengedBallots ? <span className="fig text-alert-ink"> · ~{f.challengedBallots.toLocaleString()} ballots demanded</span> : null}
              {f.standing === "rejected" ? <span className="text-muted-foreground"> · rejected</span> : null}
              <span className="text-muted-foreground">: {f.summary} </span>
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Source ({f.asOf})
                </a>
              )}
              {f.challengedBallots && f.standing !== "rejected" ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Pending: we will not project a winner whose lead is smaller than this pool. If the challenge is thrown out, this
                  stops applying.
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <span className={cn("inline-flex flex-wrap gap-x-2 gap-y-1", className)}>
      {flags.map((f, i) => (
        <span
          key={i}
          title={`${LABEL[f.kind]}${f.standing === "rejected" ? " (rejected)" : ""}: ${f.summary}${f.challengedBallots ? ` (~${f.challengedBallots.toLocaleString()} ballots)` : ""}`}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-alert-ink"
        >
          <i aria-hidden className="inline-block h-2.5 w-2.5 bg-alert" />
          {LABEL[f.kind]}
        </span>
      ))}
    </span>
  );
}
