/**
 * Official state election pages (elections office, results, voter lookup), researched per state and checked with an
 * HTTP request (scripts/data/state-links/, merged by scripts/merge-state-links.mjs). Many state sites block automated
 * checks, so the elections office is shown whenever recorded, and results / voter-lookup pages only when verified.
 */
import data from "../../../public/data/reference/state-links.json";

type Url = { url: string; verified?: boolean } | null;
type StateLinks = { abbr: string; office?: { name: string; url: string; verified?: boolean } | null; results?: Url; voterInfo?: Url };

const STATES = (data as { states: Record<string, StateLinks> }).states;

export function stateSourceLinks(abbr: string, stateName: string): { label: string; href: string; note?: string }[] {
  const s = STATES[abbr];
  if (!s) return [];
  const out: { label: string; href: string; note?: string }[] = [];
  if (s.results?.url && s.results.verified) out.push({ label: `${stateName} official election results`, href: s.results.url, note: "State election office" });
  if (s.office?.url) out.push({ label: s.office.name, href: s.office.url, note: "Official elections office" });
  if (s.voterInfo?.url && s.voterInfo.verified) out.push({ label: `Check your registration and polling place in ${stateName}`, href: s.voterInfo.url, note: "Official voter lookup" });
  return out;
}
