/**
 * Google Civic Information API v2 (https://developers.google.com/civic-information/docs/v2).
 * Server-side only: the key lives in GOOGLE_CIVIC_API_KEY and never reaches the browser. Two methods are used:
 *   GET /elections               list of elections the API knows about
 *   GET /voterinfo?address=...   polling places, early-vote sites, drop-off boxes and contests for an address
 * (The Representatives API was shut down by Google in April 2025 and is not used.)
 */
const BASE = "https://www.googleapis.com/civicinfo/v2";
const TIMEOUT_MS = 8000;

export interface CivicElection {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  electionDay: string;
}

export interface Place {
  name?: string;
  address: string;
  hours?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
}

export interface ContestCandidate {
  name: string;
  party?: string;
  url?: string;
}

export interface Contest {
  kind: "candidate" | "referendum";
  /** Office for a candidate contest, ballot title for a referendum. */
  title: string;
  level?: string;
  district?: string;
  special?: boolean;
  seats?: number;
  candidates: ContestCandidate[];
  brief?: string;
  url?: string;
}

export interface BallotLookup {
  election: CivicElection;
  address?: string;
  pollingPlaces: Place[];
  earlyVoteSites: Place[];
  dropOffLocations: Place[];
  contests: Contest[];
  mailOnly: boolean;
  officials?: { name?: string; url?: string; votingUrl?: string; registrationUrl?: string; phone?: string };
}

export class CivicError extends Error {
  constructor(
    message: string,
    /** Safe to show to the user. */
    readonly kind: "not-configured" | "no-data" | "bad-address" | "upstream",
  ) {
    super(message);
  }
}

export function civicConfigured(): boolean {
  return !!process.env.GOOGLE_CIVIC_API_KEY;
}

/**
 * The election to look up: the one on `day` (default: the configured election date), else the soonest upcoming.
 * Google's long-running "VIP Test Election" (id 2000) is never chosen.
 */
export function pickElection(list: CivicElection[], day: string, today: string): CivicElection | undefined {
  const real = list.filter((e) => e.id !== "2000" && !/test/i.test(e.name));
  return real.find((e) => e.electionDay === day) ?? real.filter((e) => e.electionDay >= today).sort((a, b) => a.electionDay.localeCompare(b.electionDay))[0];
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Raw[]) : []);

function addressLine(a: Raw | undefined): string {
  if (!a) return "";
  const street = [str(a.line1), str(a.line2), str(a.line3)].filter(Boolean).join(", ");
  const cityLine = [str(a.city), [str(a.state), str(a.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [str(a.locationName), street, cityLine].filter(Boolean).join(", ");
}

function normalizePlaces(v: unknown): Place[] {
  return arr(v)
    .map((p) => ({
      name: str(p.name),
      address: addressLine(p.address as Raw | undefined),
      hours: str(p.pollingHours),
      notes: str(p.notes),
      startDate: str(p.startDate),
      endDate: str(p.endDate),
    }))
    .filter((p) => p.address);
}

function normalizeContests(v: unknown): Contest[] {
  return arr(v).flatMap((c): Contest[] => {
    const district = str((c.district as Raw | undefined)?.name);
    const level = Array.isArray(c.level) ? str(c.level[0]) : undefined;
    if (str(c.referendumTitle)) {
      return [
        {
          kind: "referendum",
          title: str(c.referendumTitle)!,
          level,
          district,
          candidates: [],
          brief: str(c.referendumBrief) ?? str(c.referendumSubtitle),
          url: str(c.referendumUrl),
        },
      ];
    }
    const title = str(c.office) ?? str(c.ballotTitle);
    if (!title) return [];
    return [
      {
        kind: "candidate",
        title,
        level,
        district,
        special: c.special === true || undefined,
        seats: typeof c.numberElected === "number" ? c.numberElected : undefined,
        candidates: arr(c.candidates)
          .map((k) => ({ name: str(k.name) ?? "", party: str(k.party), url: str(k.candidateUrl) }))
          .filter((k) => k.name),
      },
    ];
  });
}

/** Reduce a raw voterInfoQuery response to the fields the ballot page shows. */
export function normalizeVoterInfo(raw: Raw, election: CivicElection): BallotLookup {
  const body = arr(raw.state)[0]?.electionAdministrationBody as Raw | undefined;
  const ni = raw.normalizedInput as Raw | undefined;
  return {
    election,
    address: ni ? addressLine({ ...ni, locationName: undefined }) : undefined,
    pollingPlaces: normalizePlaces(raw.pollingLocations),
    earlyVoteSites: normalizePlaces(raw.earlyVoteSites),
    dropOffLocations: normalizePlaces(raw.dropOffLocations),
    contests: normalizeContests(raw.contests),
    mailOnly: raw.mailOnly === true,
    officials: body
      ? {
          name: str(body.name),
          url: str(body.electionInfoUrl),
          votingUrl: str(body.votingLocationFinderUrl),
          registrationUrl: str(body.electionRegistrationUrl),
          phone: str((arr(body.electionOfficials)[0] ?? {}).officePhoneNumber),
        }
      : undefined,
  };
}

async function civicGet(path: string, params: Record<string, string>): Promise<{ status: number; json: Raw | undefined }> {
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) throw new CivicError("Ballot lookup is not set up on this site yet.", "not-configured");
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = (await res.json().catch(() => undefined)) as Raw | undefined;
    return { status: res.status, json };
  } catch {
    // Never surface the thrown error: it can carry the request URL, which includes the key.
    throw new CivicError("The ballot lookup service did not respond. Try again in a moment.", "upstream");
  }
}

let electionsCache: { at: number; list: CivicElection[] } | undefined;
const ELECTIONS_TTL_MS = 60 * 60 * 1000;

export async function listElections(now = Date.now()): Promise<CivicElection[]> {
  if (electionsCache && now - electionsCache.at < ELECTIONS_TTL_MS) return electionsCache.list;
  const { status, json } = await civicGet("/elections", {});
  if (status !== 200 || !json) throw new CivicError("The ballot lookup service is unavailable right now.", "upstream");
  const list = arr(json.elections)
    .map((e) => ({ id: str(e.id) ?? "", name: str(e.name) ?? "", electionDay: str(e.electionDay) ?? "" }))
    .filter((e) => e.id && e.electionDay);
  electionsCache = { at: now, list };
  return list;
}

/** Look up ballot information for a registered address. The address is not stored or logged. */
export async function lookupBallot(address: string, opts: { day?: string; today?: string } = {}): Promise<BallotLookup> {
  const day = opts.day ?? process.env.ELECTION_DATE ?? "2026-11-03";
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const election = pickElection(await listElections(), day, today);
  if (!election) throw new CivicError("No upcoming election is available from the lookup service yet.", "no-data");

  const { status, json } = await civicGet("/voterinfo", { address, electionId: election.id });
  if (status === 200 && json) return normalizeVoterInfo(json, election);
  if (status === 400) throw new CivicError("We couldn't read that address. Include the street, city and state.", "bad-address");
  if (status === 404) throw new CivicError("No ballot information is published for that address yet.", "no-data");
  throw new CivicError("The ballot lookup service is unavailable right now.", "upstream");
}
