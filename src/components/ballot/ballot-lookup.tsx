"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BallotLookup, Contest, Place } from "@/lib/civic";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: BallotLookup };

const LEVEL_ORDER = ["country", "administrativeArea1", "administrativeArea2", "locality", "special", "other"];
const LEVEL_LABEL: Record<string, string> = {
  country: "Federal",
  administrativeArea1: "State",
  administrativeArea2: "County",
  locality: "Local",
  special: "Special district",
  other: "Other",
};

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtDay = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? dayFmt.format(new Date(`${d}T00:00:00Z`)) : d);

export function BallotLookupForm() {
  const [address, setAddress] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (address.trim().length < 5) {
      setState({ status: "error", message: "Enter a full street address, city and state." });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/civic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json = (await res.json()) as BallotLookup & { error?: string };
      if (!res.ok) setState({ status: "error", message: json.error ?? "Something went wrong. Try again." });
      else setState({ status: "done", data: json });
    } catch {
      setState({ status: "error", message: "Couldn't reach the lookup service. Check your connection and try again." });
    }
  }

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardContent className="space-y-3">
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" aria-label="Ballot lookup">
            <label htmlFor="ballot-address" className="sr-only">
              Your registered address
            </label>
            <Input
              id="ballot-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, city, state, ZIP"
              autoComplete="street-address"
              className="h-9 sm:flex-1"
              maxLength={200}
            />
            <Button type="submit" disabled={state.status === "loading"}>
              {state.status === "loading" ? "Looking up…" : "Find my ballot"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            We send your address to the Google Civic Information API to look up your polling place and ballot. We don&apos;t store or log it.
            Use the address you are registered at.
          </p>
        </CardContent>
      </Card>

      <div aria-live="polite">
        {state.status === "error" && (
          <Card size="sm" className="border-dashed">
            <CardContent className="text-sm" role="alert">
              {state.message}
            </CardContent>
          </Card>
        )}
        {state.status === "done" && <Result data={state.data} />}
      </div>
    </div>
  );
}

function Result({ data }: { data: BallotLookup }) {
  const known = new Set(LEVEL_ORDER);
  const levelOf = (c: { level?: string }) => (c.level && known.has(c.level) ? c.level : "other");
  const groups = LEVEL_ORDER.map((level) => ({ level, items: data.contests.filter((c) => levelOf(c) === level) })).filter((g) => g.items.length);
  const none = !data.pollingPlaces.length && !data.earlyVoteSites.length && !data.dropOffLocations.length && !data.contests.length;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="display text-lg font-bold">{data.election.name}</h2>
        <p className="text-sm text-muted-foreground">
          {fmtDay(data.election.electionDay)}
          {data.address ? ` · ${data.address}` : ""}
        </p>
        {data.mailOnly && <p className="mt-1 text-sm font-medium">Voters at this address vote by mail only.</p>}
      </header>

      {none && (
        <Card size="sm" className="border-dashed">
          <CardContent className="text-sm">The service has no polling places or contests for this address yet. Check with your election office.</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Places title="Polling place" places={data.pollingPlaces} />
        <Places title="Early voting" places={data.earlyVoteSites} />
        <Places title="Ballot drop-off" places={data.dropOffLocations} />
      </div>

      {groups.map((g) => (
        <section key={g.level} aria-label={`${LEVEL_LABEL[g.level] ?? "Other"} contests`} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{LEVEL_LABEL[g.level] ?? "Other"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map((c, i) => (
              <ContestCard key={`${c.title}-${i}`} contest={c} />
            ))}
          </div>
        </section>
      ))}

      {data.officials && (data.officials.name || data.officials.url) && (
        <p className="text-xs text-muted-foreground">
          Election office: {data.officials.name ?? "your state"}
          {data.officials.url && (
            <>
              {" · "}
              <a href={safeUrl(data.officials.url)} className="underline-offset-2 hover:underline" rel="noreferrer noopener" target="_blank">
                election info
              </a>
            </>
          )}
          {data.officials.registrationUrl && (
            <>
              {" · "}
              <a href={safeUrl(data.officials.registrationUrl)} className="underline-offset-2 hover:underline" rel="noreferrer noopener" target="_blank">
                check registration
              </a>
            </>
          )}
          {data.officials.phone ? ` · ${data.officials.phone}` : ""}
        </p>
      )}
    </div>
  );
}

function Places({ title, places }: { title: string; places: Place[] }) {
  if (!places.length) return null;
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <ul className="space-y-2 text-sm">
          {places.slice(0, 5).map((p, i) => (
            <li key={`${p.address}-${i}`}>
              <div className="font-medium">{p.name ?? p.address}</div>
              {p.name && <div className="text-muted-foreground">{p.address}</div>}
              {p.hours && <div className="text-xs">{p.hours}</div>}
              {(p.startDate || p.endDate) && (
                <div className="text-xs text-muted-foreground">
                  {p.startDate ?? ""}
                  {p.endDate ? ` to ${p.endDate}` : ""}
                </div>
              )}
              {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
            </li>
          ))}
        </ul>
        {places.length > 5 && <p className="text-xs text-muted-foreground">{places.length - 5} more sites; see your election office.</p>}
      </CardContent>
    </Card>
  );
}

function ContestCard({ contest }: { contest: Contest }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="text-sm font-semibold">
          {contest.title}
          {contest.special && <span className="ml-1 text-xs font-normal text-muted-foreground">(special)</span>}
        </div>
        {contest.district && <div className="text-xs text-muted-foreground">{contest.district}</div>}
        {contest.kind === "referendum" ? (
          <p className="text-sm">
            {contest.brief}
            {contest.url && (
              <>
                {" "}
                <a href={safeUrl(contest.url)} className="text-xs underline-offset-2 hover:underline" rel="noreferrer noopener" target="_blank">
                  details
                </a>
              </>
            )}
          </p>
        ) : (
          <ul className="text-sm">
            {contest.candidates.map((k) => (
              <li key={k.name}>
                {k.url ? (
                  <a href={safeUrl(k.url)} className="underline-offset-2 hover:underline" rel="noreferrer noopener" target="_blank">
                    {k.name}
                  </a>
                ) : (
                  k.name
                )}
                {k.party && <span className="ml-1 text-xs text-muted-foreground">{k.party}</span>}
              </li>
            ))}
          </ul>
        )}
        {contest.seats && contest.seats > 1 && <div className="text-xs text-muted-foreground">Vote for up to {contest.seats}</div>}
      </CardContent>
    </Card>
  );
}

/** Only http(s) links from the upstream data are rendered as hrefs. */
function safeUrl(u: string): string {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : "#";
  } catch {
    return "#";
  }
}
