import type { Race } from "@/data/schema";
import { cn } from "@/lib/utils";

type Flag = NonNullable<Race["flags"]>[number];

const LABEL: Record<Flag["kind"], string> = {
  litigation: "Litigation",
  "set-aside": "Set-aside demand",
  "count-paused": "Count paused",
  advisory: "Advisory",
};

/** Labels for paused counts, litigation and set-aside demands, in amber text. A challenge is context, not a finding: each says where it stands. */
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
              {[...(f.url ? [{ name: "Source", url: f.url }] : []), ...(f.sources ?? [])].map((s, j) => (
                <a key={j} href={s.url} target="_blank" rel="noreferrer" className="mr-2 underline underline-offset-2 hover:text-foreground">
                  {s.name}
                </a>
              ))}
              <span className="text-xs text-muted-foreground">as of {f.asOf}</span>
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
          className="whitespace-nowrap text-sm font-semibold text-alert-ink"
        >
          {LABEL[f.kind]}
        </span>
      ))}
    </span>
  );
}
