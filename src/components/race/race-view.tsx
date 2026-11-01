import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { CandidateMeta, Party, RaceMeta, RatingCode } from "@/data/schema";
import type { TrendPoint } from "@/data/reference/load";
import { compact, fmtEt, fmtMarginDR, partyName, ratingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PollTrend } from "./poll-trend";
import { renderInline } from "@/lib/inline-links";
import { getCandidateImage } from "@/data/reference/images";
import { Portrait } from "./portrait";
import { Credit } from "./credit";
import { shortDate } from "@/components/state/state-content";

/** The shape of a race's story, matching src/data/reference/stories.ts. */
export type StoryLike = {
  source: { title: string; url: string; kind: "wikipedia" | "measure-summary" };
  overview: string[];
  campaigns: { candidateId?: string; name: string; party?: string; side?: "yes" | "no"; paragraphs: string[] }[];
  keyDates?: { date: string; text: string }[];
};

const partyOrder = (p: Party) => (p === "D" ? 0 : p === "R" ? 1 : 2);

/** The two candidates the race is between: one Democrat and one Republican (incumbent first), or the leading independent when a major party has none. */
export function mainCandidates(meta: RaceMeta): { main: CandidateMeta[]; others: CandidateMeta[] } {
  const pickParty = (p: Party) => {
    const side = meta.candidates.filter((c) => c.party === p);
    return side.find((c) => c.incumbent) ?? side[0];
  };
  const main = [pickParty("D"), pickParty("R")].filter((c): c is CandidateMeta => !!c);
  if (main.length < 2) {
    const ind = meta.candidates.find((c) => !main.includes(c) && c.party !== "D" && c.party !== "R");
    if (ind) main.push(ind);
  }
  main.sort((a, b) => partyOrder(a.party) - partyOrder(b.party));
  return { main, others: meta.candidates.filter((c) => !main.includes(c)) };
}

export function partyInk(p?: string): string {
  return p === "D" ? "var(--party-d-ink)" : p === "R" ? "var(--party-r-ink)" : "var(--ink)";
}

function ratingInk(r?: RatingCode): string {
  if (!r || r === "tossup") return "var(--ink)";
  return r.endsWith("-d") ? "var(--party-d-ink)" : "var(--party-r-ink)";
}

// ---------- layout pieces ----------

export function Section({ id, title, children, aside }: { id: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Fact({ label, value, color, note }: { label: string; value: ReactNode; color?: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[15px] text-ink-muted">{label}</dt>
      <dd className="mt-1.5 text-[1.75rem] font-bold leading-tight tnum" style={color ? { color } : undefined}>
        {value}
      </dd>
      {note && <dd className="mt-1 text-sm text-ink-muted">{note}</dd>}
    </div>
  );
}

export function Prose({ paragraphs, className }: { paragraphs: string[]; className?: string }) {
  return (
    <div className={cn("max-w-[68ch] space-y-4 text-[17px] leading-[1.65] text-foreground/90", className)}>
      {paragraphs.map((p, i) => (
        <p key={i}>{renderInline(p)}</p>
      ))}
    </div>
  );
}

export function SourceLine({ story }: { story: StoryLike }) {
  if (story.source.kind === "measure-summary") return <p className="text-sm text-ink-muted">Summary from the measure&apos;s official title, via Wikipedia (CC BY-SA 4.0).</p>;
  return (
    <p className="text-sm text-ink-muted">
      From Wikipedia,{" "}
      <a href={story.source.url} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
        {story.source.title}
      </a>
      , CC BY-SA 4.0.
    </p>
  );
}

// ---------- race sections ----------

export function KeyFacts({ meta, pollClose }: { meta: RaceMeta; pollClose: string }) {
  const r = meta.ratings.consensus;
  const poll = meta.polls;
  const pres = meta.baseline.presMargin2024;
  const margin = poll ? poll.d - poll.r : undefined;
  const prev = meta.baseline.prevRaceMargin;
  return (
    <dl className="grid grid-cols-2 content-center gap-x-8 gap-y-8 rounded-lg bg-card px-6 py-6 md:grid-cols-4 md:px-8 lg:grid-cols-2">
      <Fact label="Forecast" value={r ? ratingLabel[r] : "Not rated"} color={ratingInk(r)} note={r ? "Consensus of the forecasters" : undefined} />
      {prev != null ? (
        <Fact
          label={`Last ${meta.office === "governor" ? "governor" : meta.office === "senate" ? "Senate" : "House"} race`}
          value={fmtMarginDR(prev)}
          color={prev > 0 ? "var(--party-d-ink)" : prev < 0 ? "var(--party-r-ink)" : undefined}
          note={meta.baseline.prevRaceYear ? String(meta.baseline.prevRaceYear) : undefined}
        />
      ) : (
        <Fact
          label="Poll average"
          value={margin != null ? fmtMarginDR(margin) : "No polls"}
          color={margin == null ? "var(--ink-muted)" : margin > 0 ? "var(--party-d-ink)" : margin < 0 ? "var(--party-r-ink)" : undefined}
          note={poll ? `${poll.n} polls through ${shortDate(poll.asOf) ?? "recently"}` : undefined}
        />
      )}
      <Fact
        label="2024 president"
        value={pres != null ? fmtMarginDR(pres) : "—"}
        color={pres == null ? "var(--ink-muted)" : pres > 0 ? "var(--party-d-ink)" : "var(--party-r-ink)"}
        note={meta.office === "house" ? "On the 2026 district lines" : undefined}
      />
      <Fact label="Polls close" value={pollClose.replace(" ET", "")} note="Eastern time, Tuesday Nov 3" />
    </dl>
  );
}

function moneyLine(meta: RaceMeta, c: CandidateMeta): string | undefined {
  const raised = meta.money?.receipts?.[c.id];
  const cash = meta.money?.cashOnHand?.[c.id];
  if (!raised) return undefined;
  return `Raised $${compact.format(raised)}${cash != null ? ` · $${compact.format(cash)} on hand` : ""}`;
}

export function Campaigns({ meta, story }: { meta: RaceMeta; story?: StoryLike }) {
  const { main, others } = mainCandidates(meta);
  if (!main.length) return <p className="text-[17px] text-ink-muted">No candidate list is available for this race yet.</p>;
  const textFor = (c: CandidateMeta) => {
    const last = c.name.split(" ").pop()!.toLowerCase();
    return story?.campaigns.find((s) => s.candidateId === c.id || s.name.toLowerCase().includes(last))?.paragraphs ?? [];
  };
  return (
    <div className="space-y-6">
      <div className={cn("grid gap-6", main.length > 1 && "md:grid-cols-2")}>
        {main.map((c) => {
          const paras = textFor(c);
          const money = moneyLine(meta, c);
          const photo = getCandidateImage(c.id);
          return (
            <article key={c.id} className="space-y-4 rounded-lg bg-card p-6" style={{ borderTop: `3px solid ${partyInk(c.party)}` }}>
              <header className="flex items-start gap-4">
                <Portrait image={photo} name={c.name} size={84} />
                <div className="min-w-0 space-y-1">
                <h3 className="text-2xl font-bold leading-tight">{c.name}</h3>
                <p className="text-[15px] text-ink-muted">
                  <span className="font-semibold" style={{ color: partyInk(c.party) }}>
                    {partyName[c.party]}
                  </span>
                  {c.incumbent ? " · incumbent" : ""}
                </p>
                {money && <p className="text-[15px] text-ink-muted tnum">{money}</p>}
                </div>
              </header>
              {paras.length ? (
                <div className="space-y-3 text-base leading-relaxed text-foreground/90">
                  {paras.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-ink-muted">No campaign summary is available yet. The latest coverage is in the news feed.</p>
              )}
              <Credit image={photo} />
            </article>
          );
        })}
      </div>
      {others.length > 0 && (
        <p className="text-[15px] text-ink-muted">
          <span className="font-semibold text-foreground">Also on the ballot:</span>{" "}
          {others.map((c) => `${c.name} (${partyName[c.party]})`).join(", ")}
        </p>
      )}
    </div>
  );
}

export function Polling({ meta, trend }: { meta: RaceMeta; trend?: TrendPoint[] }) {
  const poll = meta.polls;
  const { main } = mainCandidates(meta);
  const d = main.find((c) => c.party === "D");
  const r = main.find((c) => c.party === "R");
  if (!poll) {
    return (
      <p className="max-w-[68ch] text-[17px] leading-relaxed text-ink-muted">
        No public poll average exists for this race, so the forecast rating and the 2024 result are the best guides.
      </p>
    );
  }
  const margin = poll.d - poll.r;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <div className="text-[15px] text-ink-muted">{d?.name ?? "Democrat"}</div>
          <div className="hero-num text-[40px]" style={{ color: "var(--party-d)" }}>
            {poll.d.toFixed(1)}
            <span className="text-2xl">%</span>
          </div>
        </div>
        <div>
          <div className="text-[15px] text-ink-muted">{r?.name ?? "Republican"}</div>
          <div className="hero-num text-[40px]" style={{ color: "var(--party-r)" }}>
            {poll.r.toFixed(1)}
            <span className="text-2xl">%</span>
          </div>
        </div>
        <p className="pb-2 text-[15px] text-ink-muted">
          <span className="font-semibold text-foreground">{fmtMarginDR(margin)}</span> across {poll.n} polls through {shortDate(poll.asOf)}. {poll.source}.
        </p>
      </div>
      {trend && trend.length > 1 && (
        <figure data-reveal className="space-y-2 rounded-lg bg-card p-4 sm:p-6">
          <PollTrend points={trend} dName={d?.name ?? "Democrat"} rName={r?.name ?? "Republican"} />
          <figcaption className="text-sm text-ink-muted">Weekly rolling average since {new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(Date.parse(trend[0].t))}.</figcaption>
        </figure>
      )}
    </div>
  );
}

export function QaList({ qa }: { qa: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-border rounded-lg bg-card">
      {qa.map((item) => (
        <details key={item.q} className="group px-6 py-4 open:pb-5">
          <summary className="cursor-pointer list-none text-[17px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex items-start justify-between gap-4">
              {item.q}
              <span aria-hidden className="mt-0.5 text-ink-muted transition-transform group-open:rotate-45">
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 max-w-[68ch] text-base leading-relaxed text-ink-muted">{renderInline(item.a)}</p>
        </details>
      ))}
    </div>
  );
}

export function LinkList({ items }: { items: { href: string; label: string; detail?: string }[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((r) => (
        <li key={r.href}>
          <Link
            href={r.href}
            className="flex items-baseline justify-between gap-4 rounded-md bg-s2 px-4 py-3.5 transition-colors outline-none hover:bg-s3 focus-visible:ring-[3px] focus-visible:ring-signal"
          >
            <span className="font-semibold">{r.label}</span>
            {r.detail && <span className="shrink-0 text-sm text-ink-muted">{r.detail}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const pollCloseLabel = (pollCloseEt: string) => fmtEt(pollCloseEt);

// ---------- money ----------

const usd = (n: number) => `$${compact.format(n)}`;

/** Raised and cash on hand for the two main candidates, as bars on one shared scale (FEC filings). */
export function Money({ meta }: { meta: RaceMeta }) {
  const receipts = meta.money?.receipts ?? {};
  const cash = meta.money?.cashOnHand ?? {};
  const { main } = mainCandidates(meta);
  const rows = main.filter((c) => (receipts[c.id] ?? 0) > 0);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((c) => receipts[c.id]));
  const lead = [...rows].sort((a, b) => receipts[b.id] - receipts[a.id]);
  const ratio = lead.length > 1 && receipts[lead[1].id] > 0 ? receipts[lead[0].id] / receipts[lead[1].id] : undefined;
  return (
    <div className="space-y-5">
      {ratio && ratio >= 1.2 && (
        <p className="max-w-[68ch] text-[17px] leading-relaxed text-foreground/90">
          <span className="font-semibold">{lead[0].name}</span> has raised {ratio >= 2 ? `${ratio.toFixed(1)} times` : `${Math.round((ratio - 1) * 100)}% more than`}{" "}
          {ratio >= 2 ? "as much as " : ""}
          {lead[1].name}.
        </p>
      )}
      <div data-reveal className="space-y-5 rounded-lg bg-card p-4 sm:p-6">
        {rows.map((c, i) => {
          const fill = c.party === "D" ? "var(--party-d)" : c.party === "R" ? "var(--party-r)" : "var(--party-i)";
          const r = receipts[c.id];
          const h = cash[c.id];
          return (
            <div key={c.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-base font-semibold" style={{ color: partyInk(c.party) }}>
                  {c.name}
                </span>
                <span className="text-[15px] text-muted-foreground tnum">
                  <span aria-hidden className="mr-1.5 inline-block size-2 align-middle opacity-40" style={{ background: fill }} />
                  <span className="font-semibold text-foreground">{usd(r)}</span> raised
                  {h != null && (
                    <>
                      <span aria-hidden className="mr-1.5 ml-3 inline-block size-2 align-middle" style={{ background: fill }} />
                      <span className="font-semibold text-foreground">{usd(h)}</span> on hand
                    </>
                  )}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden bg-s3" aria-hidden>
                <div className="chart-grow-x absolute inset-y-0 left-0 opacity-40" style={{ width: `${(r / max) * 100}%`, background: fill, "--j": i * 2 } as CSSProperties} />
                {h != null && <div className="chart-grow-x absolute inset-y-0 left-0" style={{ width: `${(Math.min(h, r) / max) * 100}%`, background: fill, "--j": i * 2 + 1 } as CSSProperties} />}
              </div>
            </div>
          );
        })}
        <p className="text-[13px] text-muted-foreground">
          FEC filings through {meta.money?.asOf ? shortDate(meta.money.asOf) : "the latest report"}.
        </p>
      </div>
    </div>
  );
}

// ---------- sources ----------

export type SourceLink = { label: string; href: string; note?: string };

/** Primary sources for a race: FEC filings for each candidate, the state's election office and results page. */
export function Sources({ links }: { links: SourceLink[] }) {
  if (!links.length) return null;
  return (
    <ul className="divide-y divide-border rounded-lg bg-card">
      {links.map((l) => (
        <li key={`${l.href} ${l.label}`}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 transition-colors outline-none hover:bg-s3/50 focus-visible:ring-[3px] focus-visible:ring-signal"
          >
            <span className="font-semibold underline-offset-4 group-hover:underline">{l.label}</span>
            {l.note && <span className="text-sm text-muted-foreground">{l.note}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
