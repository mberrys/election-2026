"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import { useNow } from "@/hooks/use-now";
import type { BallotLookup, Contest, Place } from "@/lib/civic";
import {
  directionsUrl,
  expandIndex,
  groupContests,
  matchContest,
  partyLabel,
  raceHref,
  safeUrl,
  splitPlace,
  stateFromAddress,
  type BallotIndex,
  type RaceRef,
} from "./ballot-races";
import { ExternalLink, GroupHeading, Notice, textLink } from "./link-row";
import { VOTE_ORG } from "./links";
import { StateRaces } from "./state-races";

type Lookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "error"; code: number; message?: string }
  | { status: "done"; data: BallotLookup };

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const isDay = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const fmtDay = (d: string) => (isDay(d) ? dayFmt.format(new Date(`${d}T00:00:00Z`)) : d);
const fmtShort = (d: string) => (isDay(d) ? shortFmt.format(new Date(`${d}T00:00:00Z`)) : d);

/** Title and next step for each failure, keyed by HTTP status (0 = network). */
function errorCopy(code: number, message?: string): { title: string; body: string } {
  if (code === 400 || code === 422) return { title: "We couldn't find that address", body: `${message ?? "Check the street, city and state."} Then try again.` };
  if (code === 404) return { title: "No ballot details for this address yet", body: message ?? "Google hasn't published ballot information for this address." };
  if (code === 429) return { title: "Too many lookups", body: "Wait a minute, then try again." };
  if (code === 503) return { title: "Address lookup is off right now", body: "The lookup service isn't set up on this site." };
  if (code === 0) return { title: "Couldn't connect", body: "Check your connection and try again." };
  return { title: "The lookup service didn't respond", body: message ?? "Try again in a moment." };
}

export function BallotLookupSection({ configured, index }: { configured: boolean; index: BallotIndex }) {
  const [address, setAddress] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [browse, setBrowse] = useState(false);
  const id = useId();
  const loading = lookup.status === "loading";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (address.trim().length < 5) {
      setLookup({ status: "invalid", message: "Enter your street address, city and state." });
      return;
    }
    setLookup({ status: "loading" });
    try {
      const res = await fetch("/api/civic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      const json = (await res.json().catch(() => ({}))) as BallotLookup & { error?: string };
      setLookup(res.ok ? { status: "done", data: json } : { status: "error", code: res.status, message: json.error });
    } catch {
      setLookup({ status: "error", code: 0 });
    }
  }

  return (
    <>
      <section aria-labelledby={`${id}-h`} className="space-y-5">
        <div className="space-y-2">
          <h2 id={`${id}-h`} className="section-title">
            Look up your ballot
          </h2>
          {configured ? (
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Enter the address where you&apos;re registered. We&apos;ll show your polling place, early voting sites and the contests on your ballot.
            </p>
          ) : null}
        </div>

        {configured ? (
          <>
            <form onSubmit={submit} noValidate aria-label="Ballot lookup" className="space-y-3">
              <label htmlFor={`${id}-address`} className="block text-[15px] font-semibold text-foreground">
                Your registered address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id={`${id}-address`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, state and ZIP"
                  autoComplete="street-address"
                  enterKeyHint="search"
                  maxLength={200}
                  aria-invalid={lookup.status === "invalid" || undefined}
                  aria-describedby={`${id}-help${lookup.status === "invalid" ? ` ${id}-err` : ""}`}
                  className="h-14 w-full min-w-0 rounded-lg border border-border-strong bg-s2 px-4 text-[18px] text-foreground outline-none transition-colors placeholder:text-ink-muted focus-visible:border-signal aria-invalid:border-foreground sm:flex-1"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-14 shrink-0 rounded-lg bg-signal px-7 text-[18px] font-semibold text-ground transition-opacity outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-foreground disabled:opacity-60"
                >
                  {loading ? "Looking up…" : "Find my ballot"}
                </button>
              </div>
              {lookup.status === "invalid" ? (
                <p id={`${id}-err`} className="text-[15px] font-medium text-foreground">
                  {lookup.message}
                </p>
              ) : null}
              <p id={`${id}-help`} className="text-[13px] leading-relaxed text-ink-muted">
                We send your address to the Google Civic Information API for this one lookup. We don&apos;t store or log it.
              </p>
            </form>

            <p role="status" className="sr-only">
              {loading ? "Looking up your ballot." : lookup.status === "done" ? "Your ballot is below." : ""}
            </p>

            {lookup.status === "idle" || lookup.status === "invalid" ? (
              browse ? (
                <div className="pt-4">
                  <StateRaces index={index} />
                </div>
              ) : (
                <button type="button" onClick={() => setBrowse(true)} className={`${textLink} inline-flex min-h-11 items-center text-[15px]`}>
                  Or pick your state instead
                </button>
              )
            ) : null}

            {lookup.status === "error" ? (
              <div className="space-y-8">
                <Notice role="alert" title={errorCopy(lookup.code, lookup.message).title}>
                  <p>
                    {errorCopy(lookup.code, lookup.message).body} In the meantime, pick your state to see the races we cover. You can
                    also <ExternalLink href={VOTE_ORG.pollingPlace}>find your polling place on Vote.org</ExternalLink>.
                  </p>
                </Notice>
                <StateRaces index={index} />
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-8">
            <Notice title="Address lookup isn't available right now">
              <p>
                Pick your state to see the federal and governor races and statewide measures on your ballot. Each one links to its
                candidates, polls and news. To find where you vote,{" "}
                <ExternalLink href={VOTE_ORG.pollingPlace}>use Vote.org&apos;s polling place locator</ExternalLink>.
              </p>
            </Notice>
            <StateRaces index={index} />
          </div>
        )}
      </section>

      {lookup.status === "done" ? <Results data={lookup.data} index={index} /> : null}
    </>
  );
}

function Results({ data, index }: { data: BallotLookup; index: BallotIndex }) {
  const races = useMemo(() => expandIndex(index), [index]);
  const st = data.state && /^[A-Z]{2}$/.test(data.state) ? data.state : stateFromAddress(data.address);
  const stateName = index.states.find((s) => s.abbr === st)?.name;
  const groups = groupContests(data.contests.map((contest) => ({ contest, race: matchContest(contest, races, { state: st, stateName }) })));
  const places = data.pollingPlaces.length + data.earlyVoteSites.length + data.dropOffLocations.length;
  const office = data.officials;

  return (
    <section aria-labelledby="your-ballot" className="space-y-10">
      <header className="space-y-2">
        <h2 id="your-ballot" className="section-title">
          Your ballot
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          <strong className="font-semibold text-foreground">{data.election.name}</strong>, {fmtDay(data.election.electionDay)}
          {data.address ? (
            <>
              <br />
              {data.address}
            </>
          ) : null}
        </p>
        {data.mailOnly ? (
          <p className="text-[15px] leading-relaxed text-ink-muted">
            <strong className="font-semibold text-foreground">Voters at this address vote by mail.</strong> Your election office mails
            the ballot. Ask it for the return deadline.
          </p>
        ) : null}
      </header>

      {!places && !data.contests.length ? (
        <div className="space-y-8">
          <Notice title="No details for this address yet">
            <p>
              Google hasn&apos;t published polling places or contests for this address. Your election office keeps the official list. Pick
              your state to see the races we cover.
            </p>
          </Notice>
          <StateRaces index={index} initial={st ?? ""} />
        </div>
      ) : null}

      <Places title="Where to vote on Election Day" places={data.pollingPlaces} />
      <Places title="Early voting" places={data.earlyVoteSites} dates />
      <Places title="Ballot drop-off" places={data.dropOffLocations} dates />

      {groups.map((g) => (
        <div key={g.key}>
          <GroupHeading note={`${g.items.length} ${g.items.length === 1 ? "contest" : "contests"}`}>{g.label}</GroupHeading>
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card">
            {g.items.map((it, i) => (
              <ContestRow key={`${it.contest.title}-${i}`} contest={it.contest} race={it.race} stateName={stateName} />
            ))}
          </ul>
        </div>
      ))}

      {places > 0 && !data.contests.length ? (
        <div className="space-y-8">
          <Notice title="Contests aren't listed for this address yet">
            <p>Pick your state to see the federal and governor races and statewide measures we cover.</p>
          </Notice>
          <StateRaces index={index} initial={st ?? ""} />
        </div>
      ) : null}

      {office && (office.name || office.url || office.phone) ? (
        <div>
          <GroupHeading>Your election office</GroupHeading>
          <div className="space-y-2 rounded-lg bg-card px-5 py-4 text-[15px] leading-relaxed text-ink-muted">
            {office.name ? <p className="text-[18px] font-semibold leading-snug text-foreground">{office.name}</p> : null}
            <p className="flex flex-wrap gap-x-5 gap-y-1">
              {office.url && safeUrl(office.url) ? <ExternalLink href={safeUrl(office.url)!}>Election information</ExternalLink> : null}
              {office.registrationUrl && safeUrl(office.registrationUrl) ? (
                <ExternalLink href={safeUrl(office.registrationUrl)!}>Check your registration</ExternalLink>
              ) : null}
              {office.phone ? (
                <a href={`tel:${office.phone.replace(/[^\d+]/g, "")}`} className={textLink}>
                  {office.phone}
                </a>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      <p className="text-[13px] leading-relaxed text-ink-muted">
        The Google Civic Information API supplies these ballot details, and they can be incomplete. Confirm them with your state or
        county election office.
        {stateName && st ? (
          <>
            {" "}
            <Link href={`/state/${st}`} className={textLink}>
              More on {stateName}
            </Link>
            .
          </>
        ) : null}
      </p>
    </section>
  );
}

function Places({ title, places, dates = false }: { title: string; places: Place[]; dates?: boolean }) {
  const [all, setAll] = useState(false);
  const now = useNow();
  if (!places.length) return null;
  const shown = all ? places : places.slice(0, 4);
  // null until mounted, so nothing date-dependent is ever prerendered.
  const today = now === null ? undefined : new Date(now).toISOString().slice(0, 10);
  return (
    <div>
      <GroupHeading note={places.length > 1 ? `${places.length} locations` : undefined}>{title}</GroupHeading>
      <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card">
        {shown.map((p, i) => {
          const ended = dates && !!today && isDay(p.endDate) && p.endDate < today;
          const { title: heading, address } = splitPlace(p);
          return (
            <li key={`${p.address}-${i}`} className="space-y-1 px-5 py-4 text-[15px] leading-relaxed text-ink-muted">
              <p className="text-[18px] font-semibold leading-snug text-foreground">{heading}</p>
              {address ? <p>{address}</p> : null}
              {dates && (p.startDate || p.endDate) ? (
                <p className={ended ? undefined : "text-foreground"}>
                  {ended ? `Ended ${fmtShort(p.endDate!)}` : [p.startDate && fmtShort(p.startDate), p.endDate && fmtShort(p.endDate)].filter(Boolean).join(" to ")}
                </p>
              ) : null}
              {p.hours ? <p className="text-foreground">{p.hours}</p> : null}
              {p.notes ? <p>{p.notes}</p> : null}
              <p>
                <ExternalLink href={directionsUrl(address ?? p.address)} className={`${textLink} inline-flex min-h-11 items-center`}>
                  Directions
                </ExternalLink>
              </p>
            </li>
          );
        })}
      </ul>
      {places.length > shown.length ? (
        <button type="button" onClick={() => setAll(true)} className={`${textLink} mt-2 inline-flex min-h-11 items-center text-[15px]`}>
          Show all {places.length} locations
        </button>
      ) : null}
    </div>
  );
}

function ContestRow({ contest: c, race, stateName }: { contest: Contest; race?: RaceRef; stateName?: string }) {
  const more = c.url ? safeUrl(c.url) : undefined;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h4 className="text-[18px] font-semibold leading-snug text-foreground">
            {c.title}
            {c.special ? <span className="font-normal text-ink-muted"> (special election)</span> : null}
          </h4>
          {c.district && c.district !== c.title && c.district !== stateName ? <p className="mt-0.5 text-[13px] text-ink-muted">{c.district}</p> : null}
        </div>
        {race ? (
          <Link href={raceHref(race.id)} className={`${textLink} -my-2.5 inline-flex min-h-11 shrink-0 items-center text-[15px]`}>
            See the race
          </Link>
        ) : null}
      </div>

      {c.kind === "referendum" ? (
        c.brief || more ? (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            {c.brief}
            {more ? (
              <>
                {c.brief ? " " : null}
                <ExternalLink href={more}>Full text</ExternalLink>
              </>
            ) : null}
          </p>
        ) : null
      ) : c.candidates.length ? (
        <ul className="mt-2 space-y-0.5">
          {c.candidates.map((k) => {
            const site = k.url ? safeUrl(k.url) : undefined;
            const party = partyLabel(k.party);
            return (
              <li key={k.name} className="flex flex-wrap items-baseline gap-x-2 py-1 text-[15px] leading-relaxed">
                {site ? (
                  <ExternalLink href={site} className={`${textLink} font-semibold`}>
                    {k.name}
                  </ExternalLink>
                ) : (
                  <span className="font-semibold text-foreground">{k.name}</span>
                )}
                {party ? <span className="text-ink-muted">{party}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {c.seats && c.seats > 1 ? <p className="mt-2 text-[13px] text-ink-muted">Vote for up to {c.seats}</p> : null}
    </li>
  );
}
