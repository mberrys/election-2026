"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { districtLabel, expandIndex, measureLabel, raceHref, type BallotIndex } from "./ballot-races";
import { ExternalLink, GroupHeading, LinkRow, RowList, textLink } from "./link-row";
import { FIND_YOUR_REP, VOTE_ORG } from "./links";

/** "Pick your state": the Senate, governor, House and statewide-measure races we cover there, each linked to its page. */
export function StateRaces({ index, initial = "" }: { index: BallotIndex; initial?: string }) {
  const [abbr, setAbbr] = useState(initial);
  const id = useId();
  const races = useMemo(() => expandIndex(index), [index]);
  const state = index.states.find((s) => s.abbr === abbr);
  const mine = races.filter((r) => r.state === abbr);
  const statewide = [...mine.filter((r) => r.office === "senate"), ...mine.filter((r) => r.office === "governor")];
  const house = mine.filter((r) => r.office === "house").sort((a, b) => (a.district ?? "").localeCompare(b.district ?? ""));
  const atLarge = house.length === 1 && house[0].district === "AL" ? house[0] : undefined;
  const measures = state
    ? mine
        .filter((r) => r.office === "ballot")
        .map((r) => ({ id: r.id, ...measureLabel(r.name ?? "", state.name) }))
        .sort((a, b) => (a.lead ?? a.rest).localeCompare(b.lead ?? b.rest, undefined, { numeric: true }))
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label htmlFor={`${id}-state`} className="block text-[15px] font-semibold text-foreground">
          Pick your state
        </label>
        <div className="relative sm:max-w-sm">
          <select
            id={`${id}-state`}
            value={abbr}
            onChange={(e) => setAbbr(e.target.value)}
            className="h-14 w-full appearance-none rounded-lg border border-border-strong bg-s2 pr-12 pl-4 text-[18px] text-foreground outline-none transition-colors focus-visible:border-signal"
          >
            <option value="">Choose a state</option>
            {index.states.map((s) => (
              <option key={s.abbr} value={s.abbr}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-muted" />
        </div>
      </div>

      {state ? (
        <div className="space-y-8" aria-live="polite">
          {!mine.length ? (
            <p className="text-[15px] leading-relaxed text-ink-muted">
              We don&apos;t cover any federal or governor races in {state.name} this year. Your election office has your full ballot.
            </p>
          ) : null}

          {statewide.length || atLarge ? (
            <div>
              <GroupHeading>Statewide races in {state.name}</GroupHeading>
              <RowList>
                {statewide.map((r) => (
                  <LinkRow
                    key={r.id}
                    href={raceHref(r.id)}
                    title={r.office === "governor" ? "Governor" : "U.S. Senate"}
                    desc={r.special ? "Special election" : undefined}
                  />
                ))}
                {atLarge ? <LinkRow href={raceHref(atLarge.id)} title="U.S. House" desc="At-large seat" /> : null}
              </RowList>
            </div>
          ) : null}

          {house.length > 1 ? (
            <div>
              <GroupHeading note={`${house.length} districts`}>U.S. House</GroupHeading>
              <p className="mb-4 text-[15px] leading-relaxed text-ink-muted">
                Pick your congressional district. Not sure which one is yours?{" "}
                <ExternalLink href={FIND_YOUR_REP}>Look it up by ZIP code on house.gov</ExternalLink>.
              </p>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2">
                {house.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={raceHref(r.id)}
                      aria-label={`${state.name} ${districtLabel(r.district ?? "")}`}
                      className="flex h-12 items-center justify-center rounded-lg border border-border bg-card text-[15px] font-semibold text-foreground tabular-nums transition-colors hover:bg-s3"
                    >
                      {Number(r.district)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {measures.length ? (
            <div>
              <GroupHeading note={`${measures.length} on the ballot`}>Statewide ballot measures</GroupHeading>
              <RowList>
                {measures.map(({ id: raceId, lead, rest }) => (
                  <LinkRow key={raceId} href={raceHref(raceId)} title={lead ?? rest} desc={lead && rest ? rest : undefined} />
                ))}
              </RowList>
            </div>
          ) : null}

          <p className="text-[15px] leading-relaxed text-ink-muted">
            Your ballot will also list state and local contests. For the full picture, see{" "}
            <Link href={`/state/${state.abbr}`} className={textLink}>
              our {state.name} page
            </Link>{" "}
            and <ExternalLink href={VOTE_ORG.pollingPlace}>find your polling place on Vote.org</ExternalLink>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
