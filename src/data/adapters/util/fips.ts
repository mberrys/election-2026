import table from "./county-fips.json";

/**
 * County name → 5-digit FIPS for the states this ingest covers.
 * `county-fips.json` is generated from `us-atlas/counties-10m.json` (Census
 * 2020 vintage); keys are lower-cased ASCII names. Virginia keys carry a
 * " county" / " city" suffix because independent cities share names with
 * counties (Richmond, Fairfax, Franklin, Roanoke, Bedford).
 * Alaska has no counties: adapters use House districts as `locality` units.
 */
const TABLE = table as Record<string, Record<string, string>>;

export const STATE_FIPS: Record<string, string> = {
  AK: "02",
  CA: "06",
  GA: "13",
  IA: "19",
  MN: "27",
  NC: "37",
  VA: "51",
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up a county FIPS by feed name. Accepts "Wake", "WAKE COUNTY",
 * "St. Louis", "RICHMOND CITY" (VA), "San Francisco County".
 */
export function countyFips(state: string, name: string): string | undefined {
  const st = state.toUpperCase();
  const byName = TABLE[st];
  if (!byName) return undefined;
  let n = norm(name);
  if (st === "VA") {
    // Normalize to the table's "<name> county|city" convention.
    if (/\bcity\b/.test(n)) n = n.replace(/\s*\bcity\b.*$/, "") + " city";
    else n = n.replace(/\s*\bcounty\b.*$/, "") + " county";
    return byName[n];
  }
  n = n.replace(/\s*\b(county|parish|borough|census area)\b.*$/, "");
  return byName[n] ?? byName[n.replace(/^st /, "saint ")] ?? byName[n.replace(/^saint /, "st ")];
}

/** Reverse lookup for feeds that only carry a FIPS (used for display names). */
export function countyName(state: string, fips: string): string | undefined {
  const byName = TABLE[state.toUpperCase()];
  if (!byName) return undefined;
  for (const [name, f] of Object.entries(byName)) if (f === fips) return titleCase(name);
  return undefined;
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Sorted county FIPS list for a state (alphabetical by Census name = numeric FIPS order). */
export function countyFipsList(state: string): string[] {
  const byName = TABLE[state.toUpperCase()];
  return byName ? Object.values(byName).sort() : [];
}
