"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { RaceMeta, StateMeta } from "@/data/schema";
import { useNational, indexRaces } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";
import { HouseProjectionAnnouncer } from "@/components/house/projection-announcer";
import { cn } from "@/lib/utils";
import { LegislaturesView } from "./legislatures-view";
import { MeasuresView } from "./measures-view";
import { buildEntries, type LiveRace } from "./states-lib";

type View = "legislatures" | "measures";
const VIEWS: View[] = ["legislatures", "measures"];

export function StatesBoard({ legs, measures, governors, states }: { legs: RaceMeta[]; measures: RaceMeta[]; governors: RaceMeta[]; states: StateMeta[] }) {
  const mounted = useMounted();
  const { data } = useNational();
  const payload = mounted ? data : undefined;
  const live = useMemo(() => indexRaces(payload) as Map<string, LiveRace>, [payload]);
  const entries = useMemo(() => buildEntries(legs, governors, measures, states, live), [legs, governors, measures, states, live]);

  // The tab and the pinned state live in the URL so a view can be shared ("/states?view=measures&state=CA").
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = params.get("view") === "measures" ? "measures" : "legislatures";
  const stParam = params.get("state")?.toUpperCase() ?? null;
  const pinned = stParam && entries.has(stParam) ? stParam : null;
  const [preview, setPreview] = useState<string | null>(null);

  const setParams = useCallback(
    (next: { view?: View; state?: string | null }) => {
      const p = new URLSearchParams(params.toString());
      if (next.view) {
        if (next.view === "legislatures") p.delete("view");
        else p.set("view", next.view);
      }
      if (next.state !== undefined) {
        if (next.state) p.set("state", next.state);
        else p.delete("state");
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const pin = useCallback((st: string | null) => setParams({ state: st }), [setParams]);
  const selectView = (v: View) => {
    setPreview(null);
    setParams({ view: v });
  };

  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ legislatures: null, measures: null });
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = VIEWS[(VIEWS.indexOf(view) + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length];
    selectView(next);
    tabRefs.current[next]?.focus();
  };

  const tabs: { id: View; label: string; short?: string; count: number; unit: string }[] = [
    { id: "legislatures", label: "Legislatures", count: legs.length, unit: "chambers" },
    { id: "measures", label: "Ballot measures", short: "Measures", count: measures.length, unit: "measures" },
  ];

  return (
    <div className="space-y-10">
      <HouseProjectionAnnouncer />

      <div role="tablist" aria-label="States and measures views" className="grid grid-cols-2 border-b border-border sm:flex sm:gap-10">
        {tabs.map((t) => {
          const on = view === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => selectView(t.id)}
              onKeyDown={onTabKey}
              className={cn(
                "-mb-px inline-flex h-14 items-center justify-center gap-2.5 border-b-[3px] px-1 text-lg font-bold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-signal sm:justify-start md:text-xl",
                on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              >
              {t.short ? (
                <>
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              ) : (
                t.label
              )}
              <span className="rounded-full bg-s3 px-2.5 py-0.5 text-sm font-semibold text-muted-foreground tnum">
                {t.count} <span className="sr-only">{t.unit}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
        {view === "legislatures" ? (
          <LegislaturesView
            entries={entries}
            active={preview}
            pinned={pinned}
            onPreview={setPreview}
            onPin={pin}
            onShowMeasures={(st) => {
              setPreview(null);
              setParams({ view: "measures", state: st });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : (
          <MeasuresView entries={entries} live={live} active={preview} pinned={pinned} onPreview={setPreview} onPin={pin} />
        )}
      </div>

      <p className="max-w-4xl text-sm leading-relaxed text-ink-muted">
        Chamber compositions, candidates, ratings and measure summaries: Wikipedia, CC BY-SA 4.0. Forecast ratings: Sabato&apos;s Crystal Ball via
        Wikipedia. Topics are matched from each measure&apos;s title. Measure texts: Ballotpedia (link-outs). Live counts come from official state and
        county feeds where available; see{" "}
        <Link href="/methodology" className="text-foreground underline underline-offset-4">
          methodology
        </Link>
        .
      </p>
    </div>
  );
}
