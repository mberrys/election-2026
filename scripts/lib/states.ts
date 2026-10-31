export interface StateRow {
  abbr: string;
  name: string;
  fips: string;
}

export const STATES: StateRow[] = [
  { abbr: "AL", name: "Alabama", fips: "01" },
  { abbr: "AK", name: "Alaska", fips: "02" },
  { abbr: "AZ", name: "Arizona", fips: "04" },
  { abbr: "AR", name: "Arkansas", fips: "05" },
  { abbr: "CA", name: "California", fips: "06" },
  { abbr: "CO", name: "Colorado", fips: "08" },
  { abbr: "CT", name: "Connecticut", fips: "09" },
  { abbr: "DE", name: "Delaware", fips: "10" },
  { abbr: "DC", name: "District of Columbia", fips: "11" },
  { abbr: "FL", name: "Florida", fips: "12" },
  { abbr: "GA", name: "Georgia", fips: "13" },
  { abbr: "HI", name: "Hawaii", fips: "15" },
  { abbr: "ID", name: "Idaho", fips: "16" },
  { abbr: "IL", name: "Illinois", fips: "17" },
  { abbr: "IN", name: "Indiana", fips: "18" },
  { abbr: "IA", name: "Iowa", fips: "19" },
  { abbr: "KS", name: "Kansas", fips: "20" },
  { abbr: "KY", name: "Kentucky", fips: "21" },
  { abbr: "LA", name: "Louisiana", fips: "22" },
  { abbr: "ME", name: "Maine", fips: "23" },
  { abbr: "MD", name: "Maryland", fips: "24" },
  { abbr: "MA", name: "Massachusetts", fips: "25" },
  { abbr: "MI", name: "Michigan", fips: "26" },
  { abbr: "MN", name: "Minnesota", fips: "27" },
  { abbr: "MS", name: "Mississippi", fips: "28" },
  { abbr: "MO", name: "Missouri", fips: "29" },
  { abbr: "MT", name: "Montana", fips: "30" },
  { abbr: "NE", name: "Nebraska", fips: "31" },
  { abbr: "NV", name: "Nevada", fips: "32" },
  { abbr: "NH", name: "New Hampshire", fips: "33" },
  { abbr: "NJ", name: "New Jersey", fips: "34" },
  { abbr: "NM", name: "New Mexico", fips: "35" },
  { abbr: "NY", name: "New York", fips: "36" },
  { abbr: "NC", name: "North Carolina", fips: "37" },
  { abbr: "ND", name: "North Dakota", fips: "38" },
  { abbr: "OH", name: "Ohio", fips: "39" },
  { abbr: "OK", name: "Oklahoma", fips: "40" },
  { abbr: "OR", name: "Oregon", fips: "41" },
  { abbr: "PA", name: "Pennsylvania", fips: "42" },
  { abbr: "RI", name: "Rhode Island", fips: "44" },
  { abbr: "SC", name: "South Carolina", fips: "45" },
  { abbr: "SD", name: "South Dakota", fips: "46" },
  { abbr: "TN", name: "Tennessee", fips: "47" },
  { abbr: "TX", name: "Texas", fips: "48" },
  { abbr: "UT", name: "Utah", fips: "49" },
  { abbr: "VT", name: "Vermont", fips: "50" },
  { abbr: "VA", name: "Virginia", fips: "51" },
  { abbr: "WA", name: "Washington", fips: "53" },
  { abbr: "WV", name: "West Virginia", fips: "54" },
  { abbr: "WI", name: "Wisconsin", fips: "55" },
  { abbr: "WY", name: "Wyoming", fips: "56" },
];

export const STATE_BY_ABBR = new Map(STATES.map((s) => [s.abbr, s]));
const BY_NAME = new Map(STATES.map((s) => [s.name.toLowerCase(), s]));
const NAMES_LONGEST_FIRST = STATES.map((s) => s.name).sort((a, b) => b.length - a.length);

export function stateByName(name: string): StateRow | undefined {
  return BY_NAME.get(name.trim().toLowerCase().replace(/\s+/g, " "));
}

/** Find the state whose name the text starts with ("Florida (special)" -> FL). */
export function stateAtStart(text: string): StateRow | undefined {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  for (const n of NAMES_LONGEST_FIRST) {
    const ln = n.toLowerCase();
    if (t === ln || t.startsWith(ln + " ") || t.startsWith(ln + "(") || t.startsWith(ln + ",") || t.startsWith(ln + "'")) {
      return BY_NAME.get(ln);
    }
  }
  return undefined;
}

export type VoteOrder = "early-first" | "eday-first" | "mixed" | "unknown";

/**
 * Hand table of general-election poll closing times (Eastern), used only when
 * thegreenpapers.com cannot be fetched or parsed. Marked embedded-unverified.
 */
export const EMBEDDED_POLL_CLOSE: Record<string, { last: string; first?: string }> = {
  AL: { last: "20:00" },
  AK: { last: "01:00", first: "00:00" },
  AZ: { last: "21:00" },
  AR: { last: "20:30" },
  CA: { last: "23:00" },
  CO: { last: "21:00" },
  CT: { last: "20:00" },
  DE: { last: "20:00" },
  DC: { last: "20:00" },
  FL: { last: "20:00", first: "19:00" },
  GA: { last: "19:00" },
  HI: { last: "23:00" },
  ID: { last: "23:00", first: "22:00" },
  IL: { last: "20:00" },
  IN: { last: "19:00", first: "18:00" },
  IA: { last: "22:00" },
  KS: { last: "21:00", first: "20:00" },
  KY: { last: "19:00", first: "18:00" },
  LA: { last: "21:00" },
  ME: { last: "20:00" },
  MD: { last: "20:00" },
  MA: { last: "20:00" },
  MI: { last: "21:00", first: "20:00" },
  MN: { last: "21:00" },
  MS: { last: "20:00" },
  MO: { last: "20:00" },
  MT: { last: "22:00" },
  NE: { last: "21:00", first: "20:00" },
  NV: { last: "22:00" },
  NH: { last: "20:00", first: "19:00" },
  NJ: { last: "20:00" },
  NM: { last: "21:00" },
  NY: { last: "21:00" },
  NC: { last: "19:30" },
  ND: { last: "21:00", first: "20:00" },
  OH: { last: "19:30" },
  OK: { last: "20:00" },
  OR: { last: "23:00", first: "22:00" },
  PA: { last: "20:00" },
  RI: { last: "20:00" },
  SC: { last: "19:00" },
  SD: { last: "21:00", first: "20:00" },
  TN: { last: "20:00", first: "19:00" },
  TX: { last: "21:00", first: "20:00" },
  UT: { last: "22:00" },
  VT: { last: "19:00" },
  VA: { last: "19:00" },
  WA: { last: "23:00" },
  WV: { last: "19:30" },
  WI: { last: "21:00" },
  WY: { last: "21:00" },
};

/** Vote-order table from docs/research/05-kornacki-analytics.md (verify before launch). */
export const VOTE_ORDER: Record<string, { order: VoteOrder; note: string }> = {
  NC: { order: "early-first", note: "Mail/early reported first; blue mirage, later Election Day shift R." },
  GA: { order: "early-first", note: "Early and mail reported first; Election Day follows; blue mirage." },
  AZ: {
    order: "mixed",
    note: "Early in-person and mail received before Election Day drop by ~8pm ET; late-arriving mail counted over following days.",
  },
  PA: {
    order: "mixed",
    note: "Mail-heavy early batches (Philadelphia, Allegheny) but big-city mail can also land late; order varies by county.",
  },
  WI: {
    order: "eday-first",
    note: "Mail cannot be processed before Election Day; Milwaukee central-count absentees report late (late Democratic shift).",
  },
  MI: { order: "unknown", note: "2024 reporting order not confirmed (research flagged UNVERIFIED)." },
  FL: { order: "unknown", note: "Commonly early/mail first but unconfirmed for 2026 (research flagged UNVERIFIED)." },
};
