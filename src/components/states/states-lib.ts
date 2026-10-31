import type { Party, Race, RaceMeta } from "@/data/schema";

export type LiveRace = Omit<Race, "units">;

export type ChamberKind = "upper" | "lower" | "unicameral";

export type ChamberControl = {
  party: Party | null; // null = coalition / tied / unknown
  called: boolean;
  label: string; // "D", "R", "Coal.", "Tied"
};

/** stateleg:XX-senate → upper; house/assembly → lower; legislature (Nebraska) → unicameral. */
export function chamberKind(meta: RaceMeta): ChamberKind {
  const d = (meta.district ?? "").toLowerCase();
  if (d === "senate") return "upper";
  if (d === "legislature") return "unicameral";
  return "lower";
}

export function chamberName(meta: RaceMeta): string {
  const d = (meta.district ?? "").toLowerCase();
  return d === "legislature" ? "Legislature" : d.charAt(0).toUpperCase() + d.slice(1);
}

/** "Current composition: R 77–28" → "R 77–28"; other notes are returned trimmed to one sentence. */
export function composition(meta: RaceMeta): string | undefined {
  const n = meta.notes;
  if (!n) return undefined;
  const m = /Current composition:\s*(.+)$/i.exec(n);
  return (m ? m[1] : n.split(". ")[0]).trim();
}

export function chamberControl(live: LiveRace | undefined, meta: RaceMeta): ChamberControl {
  if (live?.projection) {
    const p = live.projection.party;
    return { party: p === "D" || p === "R" ? p : null, called: true, label: p };
  }
  if (meta.heldBy === "D" || meta.heldBy === "R") return { party: meta.heldBy, called: false, label: meta.heldBy };
  const comp = composition(meta) ?? "";
  if (/coal/i.test(comp)) return { party: null, called: false, label: "Coal." };
  if (/(\d+)–\1/.test(comp)) return { party: null, called: false, label: "Tied" };
  return { party: null, called: false, label: "—" };
}

export function controlFill(c: ChamberControl | undefined): string {
  if (!c) return "transparent";
  const base = c.party === "D" ? "var(--party-d)" : c.party === "R" ? "var(--party-r)" : "var(--party-i)";
  if (c.called) return base;
  return `color-mix(in oklch, ${base} 55%, var(--card))`;
}

/** Strip the "(Source: …)" suffix the reference builder appends to measure descriptions. */
export function measureDescription(meta: RaceMeta): string | undefined {
  const n = meta.notes?.replace(/\s*\(Source:[^)]*\)\s*$/i, "").trim();
  return n || undefined;
}

export function ballotpediaUrl(stateName: string): string {
  return `https://ballotpedia.org/${stateName.replace(/ /g, "_")}_2026_ballot_measures`;
}

export type YesNo = { yes?: number; no?: number; yesVotes?: number; noVotes?: number };

export function yesNo(live: LiveRace | undefined): YesNo | undefined {
  if (!live || !live.candidates.length) return undefined;
  const y = live.candidates.find((c) => /^yes\b/i.test(c.name) || /^for\b/i.test(c.name));
  const n = live.candidates.find((c) => /^no\b/i.test(c.name) || /^against\b/i.test(c.name));
  if (!y && !n) return undefined;
  return { yes: y?.pct, no: n?.pct, yesVotes: y?.votes, noVotes: n?.votes };
}
