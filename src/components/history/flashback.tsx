"use client";

import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { ArrowRightIcon, PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { rampColor } from "@/components/board/hatch";
import { Swatch } from "@/components/board/hatch";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlashbackData, FlashbackPlace, FlashbackStep } from "./flashback-data";
import { FlashbackMap } from "./flashback-map";
import { FlashbackStyles } from "./flashback-styles";

/** One election per beat while playing. */
const STEP_MS = 700;

const partyInk = (m: number | null | undefined) => (m == null ? undefined : m >= 0 ? "text-party-d-ink" : "text-party-r-ink");
const short = (y: number) => `’${String(y).slice(2)}`;

interface View {
  step: number;
  prev: number;
  tick: number;
}

/**
 * Flashback: a tile map of presidential margins with a year scrubber from 1976 to the 2026 projection, a Play
 * button, and the past election the 2026 map most resembles.
 */
export function Flashback({ data }: { data: FlashbackData }) {
  const { steps, places, finding } = data;
  const last = steps.length - 1;
  const [view, setView] = useState<View>({ step: last, prev: last, tick: 0 });
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const go = useCallback(
    (next: number) =>
      setView((v) => {
        const step = Math.max(0, Math.min(last, next));
        return step === v.step ? v : { step, prev: v.step, tick: v.tick + 1 };
      }),
    [last],
  );

  // Advance one election per beat; stop on the last step.
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (view.step + 1 >= last) setPlaying(false);
      go(view.step + 1);
    }, STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, view.step, last, go]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (view.step >= last) go(0);
    setPlaying(true);
  };
  const jump = (i: number) => {
    setPlaying(false);
    go(i);
  };
  const onStep = useCallback(
    (delta: number) => {
      setPlaying(false);
      setView((v) => {
        const step = Math.max(0, Math.min(last, v.step + delta));
        return step === v.step ? v : { step, prev: v.step, tick: v.tick + 1 };
      });
    },
    [last],
  );
  const onPin = useCallback((st: string) => setPinned((cur) => (cur === st ? null : st)), []);

  const cur = steps[view.step];
  const yearLabel = cur.projected ? "2026 projected" : String(cur.year);
  const focus = preview ?? pinned;
  const place = focus ? places[focus] : undefined;
  const findingStep = finding ? steps.findIndex((x) => x.year === finding.year) : -1;
  const atFinding = findingStep >= 0 && view.step === findingStep;

  return (
    <div className="space-y-6">
      <FlashbackStyles />
      {finding && findingStep >= 0 && (
        <section aria-labelledby="flashback-finding" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="min-w-0 max-w-[66rem] space-y-1.5">
            <h2 id="flashback-finding" className="section-title">
              2026 looks most like {finding.year}
            </h2>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              State by state, 2026 sits an average of {finding.meanGap.toFixed(1)} points from the {finding.year} result, closer than any election since{" "}
              {finding.since}, and {finding.sameSide} of {finding.n} lean the same way.
            </p>
          </div>
          <button
            type="button"
            onClick={() => jump(atFinding ? last : findingStep)}
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full px-5 text-[15px] font-semibold ring-1 ring-border-strong transition-colors outline-none hover:bg-s3 focus-visible:ring-[3px] focus-visible:ring-signal md:self-auto"
          >
            {atFinding ? "Back to 2026" : `Take me to ${finding.year}`}
            <ArrowRightIcon aria-hidden className={cn("size-4 transition-transform", atFinding && "rotate-180")} />
          </button>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_30rem] 2xl:grid-cols-[minmax(0,1fr)_32rem] 2xl:gap-10">
        <div className="min-w-0 space-y-4">
          <FlashbackMap
            places={places}
            step={view.step}
            prevStep={view.prev}
            tick={view.tick}
            yearLabel={yearLabel}
            active={preview}
            pinned={pinned}
            onPreview={setPreview}
            onPin={onPin}
            onStep={onStep}
            readout={<Readout step={cur} asOf={data.asOf} />}
          />
          <p className="text-[15px] sm:hidden">
            <Matchup step={cur} asOf={data.asOf} />
          </p>
          <MapLegend className="hidden lg:flex" />
        </div>

        <aside className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-36 xl:top-28">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={togglePlay}
                aria-pressed={playing}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-signal pr-5 pl-4 text-[15px] font-bold text-ground transition-transform outline-none active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {playing ? <PauseIcon aria-hidden className="size-4 fill-current" /> : <PlayIcon aria-hidden className="size-4 fill-current" />}
                {playing ? "Pause" : "Play"}
              </button>
              <p className="text-[13px] leading-snug text-ink-muted">
                {steps[0].year} to 2026, one election every beat. States bounce when they change sides.
              </p>
            </div>
            <Scrubber steps={steps} step={view.step} onChange={jump} />
          </div>

          <div className="border-t border-border pt-5">
            {place ? (
              <PlacePanel place={place} steps={steps} step={view.step} pinned={pinned === place.id} onUnpin={() => setPinned(null)} onGo={jump} />
            ) : (
              <NationPanel data={data} step={view.step} onGo={jump} />
            )}
          </div>
          <MapLegend className="border-t border-border pt-5 lg:hidden" />
        </aside>
      </div>

      <p className="sr-only" aria-live="polite">
        {playing ? "" : `${yearLabel}. ${cur.national !== undefined ? `${cur.projected ? "Generic ballot" : "Popular vote"} ${fmtMarginDR(cur.national)}.` : ""}`}
      </p>
    </div>
  );
}

function Readout({ step, asOf }: { step: FlashbackStep; asOf?: string }) {
  return (
    <>
      <div className="flex items-baseline gap-3">
        <NumberFlow
          value={step.year}
          format={{ useGrouping: false }}
          transformTiming={{ duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          spinTiming={{ duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          className="hero-num -my-[0.25em] text-[2.5rem] leading-none sm:text-[3.5rem] xl:text-[4.25rem] 2xl:text-[5rem]"
        />
        {step.projected && <span className="text-[13px] font-semibold text-ink-muted sm:text-[15px]">projected</span>}
      </div>
      <p className="mt-2.5 hidden truncate text-[15px] sm:block xl:mt-3">
        <Matchup step={step} asOf={asOf} />
      </p>
    </>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Matchup({ step, asOf }: { step: FlashbackStep; asOf?: string }) {
  const nat = step.national;
  if (step.projected) {
    const t = asOf ? Date.parse(asOf) : NaN;
    return (
      <>
        Generic ballot <b className={cn("font-bold", partyInk(nat))}>{fmtMarginDR(nat)}</b>
        {!Number.isNaN(t) && <span className="text-ink-muted"> · polls to {dayFmt.format(t)}</span>}
      </>
    );
  }
  return (
    <>
      {step.matchup && (
        <>
          <span className="font-semibold text-party-d-ink">{step.matchup[0]}</span>
          <span className="text-ink-muted"> v </span>
          <span className="font-semibold text-party-r-ink">{step.matchup[1]}</span>
          <span className="text-ink-muted"> · </span>
        </>
      )}
      Popular vote <b className={cn("font-bold", partyInk(nat))}>{fmtMarginDR(nat)}</b>
    </>
  );
}

function Scrubber({ steps, step, onChange }: { steps: FlashbackStep[]; step: number; onChange: (i: number) => void }) {
  const last = steps.length - 1;
  const cur = steps[step];
  return (
    <div>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={step}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Election year"
        aria-valuetext={cur.projected ? "2026, projected from polls" : String(cur.year)}
        className="fb-range"
      />
      <div className="fb-ticks text-[12px] tnum" aria-hidden>
        {steps.map((x, i) => {
          // Narrow scrubbers (phones, the lg side column) label every other election plus 2026.
          const always = i === last || (i % 2 === 0 && i !== last - 1);
          return (
            <button
              key={x.year}
              type="button"
              tabIndex={-1}
              onClick={() => onChange(i)}
              className={cn(
                "fb-tick",
                "leading-5 transition-colors",
                i === step ? "font-bold text-signal-ink" : "font-medium text-ink-muted hover:text-ink",
                !always && "max-sm:hidden lg:max-xl:hidden",
              )}
              style={{ left: `${(i / last) * 100}%` }}
            >
              {short(x.year)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One cell per step on the full margin ramp; the step on screen gets a lime bar, 2026 a 2px outline. */
function MiniStrip({ margins, steps, step, onGo, label }: { margins: Array<number | null | undefined>; steps: FlashbackStep[]; step: number; onGo: (i: number) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-[3px]" role="group" aria-label={label}>
        {margins.map((m, i) => (
          <button
            key={steps[i].year}
            type="button"
            tabIndex={-1}
            onClick={() => onGo(i)}
            title={`${steps[i].projected ? "2026 projected" : steps[i].year}: ${fmtMarginDR(m)}`}
            aria-label={`${steps[i].projected ? "2026 projected" : steps[i].year}: ${fmtMarginDR(m)}`}
            className="relative h-7 min-w-0 flex-1 cursor-pointer pb-[7px] outline-none"
          >
            <span
              className={cn("block h-full rounded-[2px] transition-transform hover:scale-y-110", m == null && "bg-s3", steps[i].projected && "outline-2 -outline-offset-2 outline-ink")}
              style={m == null ? undefined : { backgroundColor: rampColor(m) }}
            />
            {i === step && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-signal" />}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-ink-muted tnum">
        <span>{steps[0].year}</span>
        <span>2026</span>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className={cn("display mt-0.5 text-[28px] leading-none font-bold tnum", partyInk(value))}>{value == null ? "No result" : fmtMarginDR(value)}</dd>
    </div>
  );
}

function PlacePanel({
  place,
  steps,
  step,
  pinned,
  onUnpin,
  onGo,
}: {
  place: FlashbackPlace;
  steps: FlashbackStep[];
  step: number;
  pinned: boolean;
  onUnpin: () => void;
  onGo: (i: number) => void;
}) {
  const last = steps.length - 1;
  const cur = steps[step];
  const atProjection = step === last;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="display text-[18px] leading-tight font-semibold">{place.name}</h3>
        {pinned && (
          <button
            type="button"
            onClick={onUnpin}
            aria-label={`Close ${place.name}`}
            className="-mt-1 -mr-1 grid size-8 place-items-center rounded-full text-ink-muted transition-colors outline-none hover:bg-s3 hover:text-ink focus-visible:ring-2 focus-visible:ring-signal"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-4">
        {atProjection ? (
          <>
            <Figure label="2026 projected" value={place.margins[last]} />
            <Figure label={`${steps[last - 1].year} result`} value={place.margins[last - 1]} />
          </>
        ) : (
          <>
            <Figure label={`${cur.year} result`} value={place.margins[step]} />
            <Figure label="2026 projected" value={place.margins[last]} />
          </>
        )}
      </dl>
      <MiniStrip margins={place.margins} steps={steps} step={step} onGo={onGo} label={`${place.name} by election`} />
      <div className="space-y-1.5">
        <p className="text-[15px] leading-relaxed">{place.sentence}</p>
        {place.basis && <p className="text-[13px] leading-snug text-ink-muted">{place.basis}</p>}
      </div>
      <Link href={`/state/${place.id}`} prefetch={false} className="inline-flex items-center gap-1.5 text-[15px] font-semibold underline-offset-4 hover:underline">
        Open {place.name}
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

function NationPanel({ data, step, onGo }: { data: FlashbackData; step: number; onGo: (i: number) => void }) {
  const { steps } = data;
  const cur = steps[step];
  return (
    <div className="space-y-5">
      <h3 className="display text-[18px] leading-tight font-semibold">United States</h3>
      <dl className="grid grid-cols-2 gap-4">
        <Figure label={cur.projected ? "Generic ballot" : `${cur.year} popular vote`} value={cur.national} />
        <div>
          <dt className="text-[13px] text-ink-muted">{cur.projected ? "States leaning, with DC" : "States carried, with DC"}</dt>
          <dd className="display mt-0.5 text-[28px] leading-none font-bold tnum">
            <span className="text-party-d-ink">{cur.dWon}</span>
            <span className="px-1.5 text-[18px] text-ink-faint">to</span>
            <span className="text-party-r-ink">{cur.rWon}</span>
          </dd>
        </div>
      </dl>
      <MiniStrip margins={steps.map((x) => x.national)} steps={steps} step={step} onGo={onGo} label="National margin by election" />
      <div className="space-y-1.5">
        <p className="text-[15px] leading-relaxed">{data.nationSentence.replace(/^Projected /, "The 2026 generic ballot is ")}</p>
        <p className="text-[13px] leading-snug text-ink-muted">
          <span className="hidden lg:inline">Hover a state to see its story; click to keep it open.</span>
          <span className="lg:hidden">Tap a state to see its story.</span>
        </p>
      </div>
    </div>
  );
}

function MapLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-muted", className)}>
      <span className="inline-flex items-center gap-[3px]" aria-hidden>
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <Swatch key={`d${n}`} kind={`ramp-d-${n}`} className="h-3.5 w-4" />
        ))}
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <Swatch key={`r${n}`} kind={`ramp-r-${n}`} className="h-3.5 w-4" />
        ))}
      </span>
      <span>Margin, D or R: under 2, 2 to 5, 5 to 10, 10 to 20, and 20+ points</span>
    </div>
  );
}
