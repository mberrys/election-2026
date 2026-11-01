import Link from "next/link";
import { stateRows } from "@/analytics/history";
import { Card, CardContent } from "@/components/ui/card";
import { loadPolls } from "@/data/reference/load";
import { buildInput } from "./build-view";
import { HistoryDetail } from "./history-detail";

/** Static Then & Now panel for one state: its projection against presidential history, with the poll trend. */
export function StateHistoryPanel({ abbr }: { abbr: string }) {
  const row = stateRows(buildInput(), "pres").find((r) => r.id === abbr);
  if (!row) return null;
  const trend = row.projection?.poll ? loadPolls().trend?.[row.projection.poll.raceId] : undefined;
  return (
    <section aria-label="Then and now" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-lg font-bold tracking-tight">Then &amp; Now</h2>
        <Link href="/history" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          All states
        </Link>
      </div>
      <Card size="sm">
        <CardContent>
          <HistoryDetail row={row} yardstick="pres" trend={trend} />
        </CardContent>
      </Card>
    </section>
  );
}
