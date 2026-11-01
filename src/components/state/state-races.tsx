import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getRacesByState } from "@/data/reference/load";
import { isRaceOffice, raceHeading, raceSlug } from "@/components/race/race-content";
import { ratingLabel } from "@/lib/format";
import type { RaceMeta } from "@/data/schema";

/** Expanded by default only when a state has a handful of House districts, so large states stay compact. */
const OPEN_HOUSE_LIMIT = 8;

function RaceRow({ meta, label }: { meta: RaceMeta; label: string }) {
  const rating = meta.ratings.consensus;
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <Link href={`/race/${raceSlug(meta)}`} className="underline-offset-2 hover:underline">
        {label}
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground">{rating ? ratingLabel[rating] : "Not rated"}</span>
    </li>
  );
}

/** Server-rendered links to every race page in a state: statewide races first, then House districts. */
export function StateRaces({ abbr, stateName }: { abbr: string; stateName: string }) {
  const races = (getRacesByState().get(abbr) ?? []).filter((r) => isRaceOffice(r.office));
  const statewide = [
    ...races.filter((r) => r.office === "senate" && !r.special),
    ...races.filter((r) => r.office === "senate" && r.special),
    ...races.filter((r) => r.office === "governor"),
  ];
  const houses = races.filter((r) => r.office === "house");
  if (statewide.length === 0 && houses.length === 0) return null;

  return (
    <section aria-label={`${stateName} races`} className="space-y-2">
      <h2 className="display text-lg font-bold tracking-tight">{stateName} races</h2>
      <Card size="sm">
        <CardContent className="space-y-4">
          {statewide.length > 0 && (
            <ul className="space-y-2">
              {statewide.map((meta) => (
                <RaceRow key={meta.id} meta={meta} label={raceHeading(meta, stateName)} />
              ))}
            </ul>
          )}
          {houses.length > 0 && (
            <details open={houses.length <= OPEN_HOUSE_LIMIT}>
              <summary className="cursor-pointer text-sm font-semibold underline-offset-2 hover:underline">
                House districts ({houses.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {houses.map((meta) => (
                  <RaceRow key={meta.id} meta={meta} label={meta.name} />
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
