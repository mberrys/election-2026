import type { Metadata } from "next";
import { CreditRow } from "@/components/race/credit-row";
import { getCandidateImage, getStateImage, type CreditedImage } from "@/data/reference/images";
import { loadRaces, loadStates } from "@/data/reference/load";
import type { RaceMeta } from "@/data/schema";
import { pageMetadata } from "@/lib/page-meta";
import { raceHref } from "@/lib/race-slug";

export const metadata: Metadata = pageMetadata({
  title: "Photo credits",
  description: "Who took each candidate and state capitol photo on the Big Board, and the licence it is used under.",
  path: "/credits",
});

type Entry = { id: string; name: string; href: string; note?: string; image: CreditedImage };

const PARTY_RANK: Record<string, number> = { D: 0, R: 1, I: 2 };
const GRID = "grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** Candidates with a photo in the given races, once each, ordered by race then party. */
function entriesFor(races: RaceMeta[], note?: (m: RaceMeta) => string): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const m of races) {
    const cands = [...m.candidates].sort((a, b) => (PARTY_RANK[a.party] ?? 3) - (PARTY_RANK[b.party] ?? 3) || a.name.localeCompare(b.name));
    for (const c of cands) {
      const image = getCandidateImage(c.id);
      if (!image || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ id: c.id, name: c.name, href: raceHref(m.id), note: note?.(m), image });
    }
  }
  return out;
}

export default function CreditsPage() {
  const races = loadRaces();
  const states = loadStates();
  const stateName = new Map(states.map((s) => [s.abbr, s.name]));
  const byState = (a: RaceMeta, b: RaceMeta) =>
    (stateName.get(a.state) ?? a.state).localeCompare(stateName.get(b.state) ?? b.state) || (a.district ?? "").localeCompare(b.district ?? "", "en", { numeric: true });

  const senate = entriesFor(races.filter((m) => m.office === "senate").sort(byState), (m) => stateName.get(m.state) ?? m.state);
  const governors = entriesFor(races.filter((m) => m.office === "governor").sort(byState), (m) => stateName.get(m.state) ?? m.state);

  const houseRaces = races.filter((m) => m.office === "house").sort(byState);
  const houseGroups = states
    .map((s) => ({ state: s, entries: entriesFor(houseRaces.filter((m) => m.state === s.abbr), (m) => m.district ?? "") }))
    .filter((g) => g.entries.length > 0);

  const capitols = states
    .map((s) => ({ s, image: getStateImage(s.abbr) }))
    .filter((x): x is { s: (typeof states)[number]; image: CreditedImage } => !!x.image);

  const total = senate.length + governors.length + houseGroups.reduce((n, g) => n + g.entries.length, 0) + capitols.length;

  return (
    <article className="space-y-12">
      <header className="page-header">
        <h1 className="page-title">Photo credits</h1>
        <p className="page-lede">
          {total} photos from Wikimedia Commons, each public domain, CC0, CC BY or CC BY-SA. Hover a face on the site for its credit.
        </p>
      </header>

      <Group title="Senate" count={senate.length}>
        <ul className={GRID}>
          {senate.map((e) => (
            <CreditRow key={e.id} image={e.image} name={e.name} href={e.href} note={e.note} />
          ))}
        </ul>
      </Group>

      <Group title="Governor" count={governors.length}>
        <ul className={GRID}>
          {governors.map((e) => (
            <CreditRow key={e.id} image={e.image} name={e.name} href={e.href} note={e.note} />
          ))}
        </ul>
      </Group>

      <Group title="House" count={houseGroups.reduce((n, g) => n + g.entries.length, 0)}>
        <div className="space-y-8">
          {houseGroups.map((g) => (
            <section key={g.state.abbr} aria-labelledby={`house-${g.state.abbr}`}>
              <h3 id={`house-${g.state.abbr}`} className="mb-1 text-lg font-semibold">
                {g.state.name}
              </h3>
              <ul className={GRID}>
                {g.entries.map((e) => (
                  <CreditRow key={e.id} image={e.image} name={e.name} href={e.href} note={e.note ? `${g.state.abbr}-${e.note}` : g.state.abbr} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Group>

      <Group title="State capitols" count={capitols.length}>
        <ul className={GRID}>
          {capitols.map(({ s, image }) => (
            <CreditRow key={s.abbr} image={image} name={s.name} href={`/state/${s.abbr}`} />
          ))}
        </ul>
      </Group>
    </article>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-title">
        {title} <span className="tnum font-normal text-muted-foreground">{count}</span>
      </h2>
      {children}
    </section>
  );
}
