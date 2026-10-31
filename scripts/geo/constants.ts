/**
 * Static tables for the geometry build: state FIPS codes, 2026 apportionment,
 * source URLs, and the us-atlas projection parameters we replicate.
 */

export interface StateInfo {
  fips: string;
  abbr: string;
  name: string;
}

// 50 states + DC. Territories (60 AS, 66 GU, 69 MP, 72 PR, 78 VI) are skipped:
// they do not appear on the Albers USA composite projection.
export const STATES: StateInfo[] = [
  { fips: "01", abbr: "AL", name: "Alabama" },
  { fips: "02", abbr: "AK", name: "Alaska" },
  { fips: "04", abbr: "AZ", name: "Arizona" },
  { fips: "05", abbr: "AR", name: "Arkansas" },
  { fips: "06", abbr: "CA", name: "California" },
  { fips: "08", abbr: "CO", name: "Colorado" },
  { fips: "09", abbr: "CT", name: "Connecticut" },
  { fips: "10", abbr: "DE", name: "Delaware" },
  { fips: "11", abbr: "DC", name: "District of Columbia" },
  { fips: "12", abbr: "FL", name: "Florida" },
  { fips: "13", abbr: "GA", name: "Georgia" },
  { fips: "15", abbr: "HI", name: "Hawaii" },
  { fips: "16", abbr: "ID", name: "Idaho" },
  { fips: "17", abbr: "IL", name: "Illinois" },
  { fips: "18", abbr: "IN", name: "Indiana" },
  { fips: "19", abbr: "IA", name: "Iowa" },
  { fips: "20", abbr: "KS", name: "Kansas" },
  { fips: "21", abbr: "KY", name: "Kentucky" },
  { fips: "22", abbr: "LA", name: "Louisiana" },
  { fips: "23", abbr: "ME", name: "Maine" },
  { fips: "24", abbr: "MD", name: "Maryland" },
  { fips: "25", abbr: "MA", name: "Massachusetts" },
  { fips: "26", abbr: "MI", name: "Michigan" },
  { fips: "27", abbr: "MN", name: "Minnesota" },
  { fips: "28", abbr: "MS", name: "Mississippi" },
  { fips: "29", abbr: "MO", name: "Missouri" },
  { fips: "30", abbr: "MT", name: "Montana" },
  { fips: "31", abbr: "NE", name: "Nebraska" },
  { fips: "32", abbr: "NV", name: "Nevada" },
  { fips: "33", abbr: "NH", name: "New Hampshire" },
  { fips: "34", abbr: "NJ", name: "New Jersey" },
  { fips: "35", abbr: "NM", name: "New Mexico" },
  { fips: "36", abbr: "NY", name: "New York" },
  { fips: "37", abbr: "NC", name: "North Carolina" },
  { fips: "38", abbr: "ND", name: "North Dakota" },
  { fips: "39", abbr: "OH", name: "Ohio" },
  { fips: "40", abbr: "OK", name: "Oklahoma" },
  { fips: "41", abbr: "OR", name: "Oregon" },
  { fips: "42", abbr: "PA", name: "Pennsylvania" },
  { fips: "44", abbr: "RI", name: "Rhode Island" },
  { fips: "45", abbr: "SC", name: "South Carolina" },
  { fips: "46", abbr: "SD", name: "South Dakota" },
  { fips: "47", abbr: "TN", name: "Tennessee" },
  { fips: "48", abbr: "TX", name: "Texas" },
  { fips: "49", abbr: "UT", name: "Utah" },
  { fips: "50", abbr: "VT", name: "Vermont" },
  { fips: "51", abbr: "VA", name: "Virginia" },
  { fips: "53", abbr: "WA", name: "Washington" },
  { fips: "54", abbr: "WV", name: "West Virginia" },
  { fips: "55", abbr: "WI", name: "Wisconsin" },
  { fips: "56", abbr: "WY", name: "Wyoming" },
];

export const FIPS_TO_STATE: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((s) => [s.fips, s]),
);
export const ABBR_TO_STATE: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((s) => [s.abbr, s]),
);

/** 2020-census apportionment, in force for the 2022–2030 cycles. Sums to 435. */
export const APPORTIONMENT_2026: Record<string, number> = {
  CA: 52, TX: 38, FL: 28, NY: 26, IL: 17, PA: 17, OH: 15, GA: 14, NC: 14, MI: 13,
  NJ: 12, VA: 11, WA: 10, AZ: 9, IN: 9, MA: 9, TN: 9, CO: 8, MD: 8, MN: 8, MO: 8,
  WI: 8, AL: 7, SC: 7, KY: 6, LA: 6, OR: 6, CT: 5, OK: 5, AR: 4, IA: 4, KS: 4,
  MS: 4, NV: 4, UT: 4, NE: 3, NM: 3, ID: 2, HI: 2, ME: 2, MT: 2, NH: 2, RI: 2,
  WV: 2, AK: 1, DE: 1, ND: 1, SD: 1, VT: 1, WY: 1,
};

export const AT_LARGE_STATES = new Set(
  Object.entries(APPORTIONMENT_2026)
    .filter(([, n]) => n === 1)
    .map(([st]) => st),
);

// ---------- sources ----------

export const TIGER_2026_CD_URL = (fips: string) =>
  `https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_${fips}_cd120.zip`;

/** 119th-Congress Missouri lines, full TIGER resolution (same vintage lines as cb_2025 cd119). */
export const TIGER_2025_MO_CD119_URL =
  "https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_29_cd119.zip";

/** 119th-Congress cartographic boundary file (national, 1:500k). Fallback MO source. */
export const CB_2025_CD119_URL =
  "https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_500k.zip";

/**
 * The Downballot (formerly Daily Kos Elections) Congressional District Hexmap.
 * https://dkel.ec/map now redirects to https://the-db.co/maps (a Google Sheet);
 * the "Congressional District Hexmap" tab links these Drive files.
 * Version 3.2 is "valid for 2026 only" (CA, FL, NC, OH, TN, TX, UT updated).
 */
export const DOWNBALLOT_HEXMAP = {
  version: "3.2",
  pageUrl: "https://the-db.co/maps",
  legacyUrl: "https://dkel.ec/map",
  license: "CC BY 4.0",
  attribution: "Daily Kos Elections / The Downballot (Daniel Donner), https://dkel.ec/map",
  files: {
    cds: "https://drive.google.com/uc?export=download&id=18acMZLOjpQlyj_c-2q0QktmcsjM6Obrk",
    states: "https://drive.google.com/uc?export=download&id=10thkt1J_lpHSZvqLmOOmIbclqq1ct9zv",
  },
} as const;

// ---------- projection ----------

/** us-atlas: d3.geoAlbersUsa().scale(1300).translate([487.5, 305]) in a 975×610 viewport. */
export const US_ATLAS_PROJECTION = {
  scale: 1300,
  translate: [487.5, 305] as [number, number],
  viewport: [975, 610] as [number, number],
  quantization: 1e5,
};
