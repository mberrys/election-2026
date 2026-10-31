import { raceId, type Office } from "../../schema";

/**
 * Contest name → Big Board race identity.
 *
 * Every feed spells offices differently; the table below is ordered and the
 * first matching pattern wins. Patterns may be scoped to a feed id. Only
 * Senate / House / Governor (and ballot measures when a feed exposes them in a
 * parseable way) resolve; everything else returns `null` and is skipped.
 *
 * Verified feed spellings (2026-10-30):
 *   nc-ncsbe        "US SENATE (VOTE FOR 1)", "US HOUSE OF REPRESENTATIVES DISTRICT 01 (VOTE FOR 1)", "NC GOVERNOR (VOTE FOR 1)"
 *   enhanced-voting VA "Member, United States Senate", "Member, House of Representatives (1st District)",
 *                   VA 2025 "Governor"; GA 2024 "President of the US", "US House of Representatives - District 1"
 *   ca-sos          "Governor - Statewide Results", "U.S. House of Representatives District 13 - Districtwide Results"
 *   mn-sos          "U.S. Senator", "U.S. Representative District 1", "Governor & Lt Governor"
 *   ak-doe          "U.S. Senator", "U.S. Representative", "Governor / Lieutenant Governor"
 *   clarity (IA)    "United States Senator", "United States Representative District 1", "Governor and Lt. Governor"
 */

export interface ResolvedContest {
  id: string;
  office: Office;
  state: string;
  district?: string;
  special: boolean;
  name: string;
}

const AT_LARGE = new Set(["AK", "DE", "ND", "SD", "VT", "WY"]);

interface Pattern {
  feed?: string;
  office: Office;
  re: RegExp;
  /** Extract district from the match; return undefined for at-large / statewide. */
  district?: (m: RegExpMatchArray, state: string) => string | undefined | null;
}

const ORD = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const US = String.raw`(?:u\.?\s?s\.?|united\s+states)`;

const PATTERNS: Pattern[] = [
  // ---- Senate ----
  { office: "senate", re: new RegExp(String.raw`^(?:member,?\s+)?${US}\s+senat(?:e|or)\b`, "i") },
  // ---- House ----
  {
    office: "house",
    re: new RegExp(
      String.raw`^(?:member,?\s+)?${US}\s+(?:house(?:\s+of\s+representatives)?|representative|rep\.?|congress(?:ional)?(?:\s+district)?)\b(.*)$`,
      "i",
    ),
    district: (m, state) => districtFrom(m[1] ?? "", state),
  },
  // VA EV: "Member, House of Representatives (1st District)" (no "US" prefix; VA's state body is "House of Delegates").
  {
    office: "house",
    re: /^member,?\s+house\s+of\s+representatives\b(.*)$/i,
    district: (m, state) => districtFrom(m[1] ?? "", state),
  },
  // ---- Governor ---- (ticket spellings; "Lieutenant Governor" alone is excluded below)
  { office: "governor", re: /^(?:[a-z]{2}\s+)?governor\b/i },
];

function districtFrom(tail: string, state: string): string | undefined | null {
  const m =
    tail.match(new RegExp(String.raw`district\s*(?:no\.?\s*)?0*(\d{1,2})\b`, "i")) ??
    tail.match(new RegExp(String.raw`\(?\s*${ORD}\s+(?:congressional\s+)?district`, "i")) ??
    tail.match(/^\s*-?\s*0*(\d{1,2})\b/);
  if (m?.[1]) return m[1].padStart(2, "0");
  if (/at[\s-]*large/i.test(tail) || AT_LARGE.has(state.toUpperCase())) return "AL";
  return null; // ambiguous: a header row like "US HOUSE OF REPRESENTATIVES" with no district
}

/** Normalize feed decoration: "(VOTE FOR 1)", " - Statewide Results", trailing whitespace. */
export function cleanContestName(raw: string): string {
  return raw
    .replace(/\s*\(vote\s+for\s+\d+\)\s*/gi, " ")
    .replace(/\s*-\s*(statewide|districtwide|countywide)\s+results\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveContest(rawName: string, state: string, feed?: string): ResolvedContest | null {
  const name = cleanContestName(rawName);
  if (!name) return null;
  // Exclude down-ballot offices that would otherwise collide with the governor pattern.
  if (/^(?:[a-z]{2}\s+)?(?:lt\.?|lieutenant)\s+governor/i.test(name)) return null;
  // State legislature spellings must never reach the federal patterns.
  if (/^(?:[a-z]{2}\s+)?state\s+(?:senat|house|rep)/i.test(name)) return null;

  const st = state.toUpperCase();
  for (const p of PATTERNS) {
    if (p.feed && p.feed !== feed) continue;
    const m = name.match(p.re);
    if (!m) continue;
    let district: string | undefined;
    if (p.district) {
      const d = p.district(m, st);
      if (d === null) return null;
      district = d;
    }
    const special = /\b(special|unexpired|partial\s+term|to\s+fill\s+vacancy)\b/i.test(name);
    return {
      id: raceId(p.office, st, district, special),
      office: p.office,
      state: st,
      district,
      special,
      name: displayName(p.office, st, district, special),
    };
  }
  return null;
}

export function displayName(office: Office, state: string, district?: string, special = false): string {
  const sp = special ? " (Special)" : "";
  if (office === "senate") return `${state} U.S. Senate${sp}`;
  if (office === "governor") return `${state} Governor${sp}`;
  if (office === "house") return `${state}-${district ?? "AL"} U.S. House${sp}`;
  return `${state} ${office} ${district ?? ""}`.trim();
}

/** Ballot measure id helper: `ballot:CA-prop-50`. */
export function ballotRaceId(state: string, slug: string): string {
  return raceId("ballot", state, slug);
}
