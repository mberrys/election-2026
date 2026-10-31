import type { Party } from "../../schema";

/**
 * Feed party labels → schema Party (D R I L G O).
 * Keys are lower-cased, punctuation-stripped. Composite codes such as AK's
 * "REP/NON" (registered REP, nominated nonpartisan) resolve on the first token.
 */
const PARTY_MAP: Record<string, Party> = {
  // Democrats
  d: "D",
  dem: "D",
  democrat: "D",
  democratic: "D",
  dfl: "D", // Minnesota Democratic-Farmer-Labor
  "democratic farmer labor": "D",
  "democratic party": "D",
  // Republicans
  r: "R",
  rep: "R",
  gop: "R",
  republican: "R",
  "republican party": "R",
  // Libertarian
  l: "L",
  lib: "L",
  lbt: "L",
  libertarian: "L",
  // Green
  g: "G",
  gp: "G",
  grn: "G",
  gre: "G",
  green: "G",
  "pacific green": "G",
  "green party": "G",
  // Independent / unaffiliated / nonpartisan
  i: "I",
  ind: "I",
  indep: "I",
  independent: "I",
  una: "I",
  unaffiliated: "I",
  und: "I",
  undeclared: "I",
  npa: "I",
  np: "I",
  npp: "I",
  "no party": "I",
  "no party preference": "I",
  "no party affiliation": "I",
  non: "I",
  nonpartisan: "I",
  "non partisan": "I",
  nop: "I",
  ipa: "I", // Independence-Alliance (MN) treated as independent
  "independent party": "I",
};

export function normalizeParty(raw: string | null | undefined): Party {
  if (!raw) return "O";
  const first = raw.split("/")[0] ?? raw;
  const key = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key) return "O";
  const hit = PARTY_MAP[key];
  if (hit) return hit;
  // "Democratic-NPL", "Working Families Democrat", etc.
  if (/\bdemocrat/.test(key)) return "D";
  if (/\brepublican\b/.test(key)) return "R";
  if (/\blibertarian\b/.test(key)) return "L";
  if (/\bgreen\b/.test(key)) return "G";
  if (/\b(independent|nonpartisan|unaffiliated|no party)\b/.test(key)) return "I";
  return "O";
}
