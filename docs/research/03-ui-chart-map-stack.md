# UI, chart and map stack (gap-fill research, seen 2026-10-30)

Versions from `npm view` today; sizes from bundlephobia; hosted-page facts from WebFetch.

## Recommendations

1. **UI: shadcn/ui, not Tremor.** Tailwind v4, `tw-animate-css`, shadcn Charts (Recharts v3). Base UI is now the default; `npx shadcn init -b radix` for Radix.
2. **Charts: Recharts v3 for standard panels** (bars, lines, balance-of-power) via shadcn `ChartContainer`. **Hand-roll bespoke visuals in plain SVG with d3-scale/d3-shape** (needle gauges, swing arrows, hex cartogram); `@visx/*` primitives where convenient. Skip ECharts and Nivo.
3. **Maps: SVG with d3-geo + TopoJSON, pre-built at build time.** Counties from `us-atlas` counties-10m. Districts: build TopoJSON yourself from Census TIGER 2026 `cd120`. Render `<path>` in a server component, recolor client-side via CSS vars/classes. Avoid MapLibre/deck.gl unless precinct zoom is needed. Hex cartogram: reuse Daily Kos 2022 hexmap layout.
4. **Live updates.** Numbers: `@number-flow/react`. Data: TanStack Query `refetchInterval` baseline, SSE as upgrade. Leaderboards: `motion` `layout`. A11y: one throttled `aria-live="polite"` summary region, animated numbers outside it.

## 1. Design system (verified)

- **shadcn/ui** (MIT, last push 2026-10-30, ~127k stars, CLI `shadcn` 4.23.0). Tailwind v4 Feb 2025, React 19 Oct 2024. July 2026: Base UI default, Radix not deprecated (https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default). Chart component "now uses Recharts v3" (https://ui.shadcn.com/docs/components/chart): use `var(--chart-1)` not `hsl(var(--chart-1))`; give `ChartContainer` explicit height/aspect; set `accessibilityLayer`. Free chart blocks: https://ui.shadcn.com/charts/area.
- **Tremor: avoid.** Vercel acquired Jan 22 2025; blocks free/MIT. `@tremor/react` 3.18.7 last published 2025-01-13, peer `react ^18.0.0` (no React 19). Repo last pushed 2025-10-10. No 2026 releases.
- **Radix Themes** 3.3.0 (2026-01-31) — own CSS system, not Tailwind.
- **Mantine** 9.7.4, requires `react ^19.2.0` — maintained, non-Tailwind, heavy.
- **Park UI** — `@park-ui/panda-preset` untouched since 2024-11. Weakest option.
- Verified free options: shadcn blocks/charts, Tremor Blocks (MIT). Paid template pricing not verified.

## 2. Chart stack

| Library | Version | Size (min / gzip) | Notes |
|---|---|---|---|
| Recharts | 3.10.1 | 562 kB / 150 kB | peer React 16.8–19 |
| visx | 4.0.0 | `@visx/shape` 36 kB / 11 kB | peer React 18/19; React 19 support June 2026 |
| Observable Plot | 0.6.17 | 388 kB / 130 kB | imperative DOM; poor fit for React re-renders |
| Nivo | 0.99.0 | `@nivo/line` 285 kB / 96 kB | last modified 2025-05-23 |
| ECharts | 6.1.0 | 1.1 MB / 368 kB | best canvas throughput; large; not RSC-friendly |

- **Recharts 3:** state rewritten, `accessibilityLayer` default true, `recharts-scale`/`react-smooth` removed (3.0 migration guide). Not RSC-native — interactive charts need `"use client"`. Old hydration-mismatch issue (#2272) from animation; set `isAnimationActive={false}` on live charts.
- **visx:** low-level SVG primitives, work in RSC when stateless, smallest option.
- No credible re-renders/sec benchmark found — profile; keep live charts to a few dozen series.

## 3. Maps and geometry

- **us-atlas** 3.0.1 (2023-04-19): counties, states, nation at 10m (unprojected + Albers); Census CB 2017 edition. No congressional districts. Fine for counties (stable geometry).
- **Census 2025 cartographic:** `cb_2025_us_cd119_{20m,5m,500k}.zip` (500k = 6.7 MB), modified 2026-04-23 (https://www2.census.gov/geo/tiger/GENZ2025/shp/). 119th Congress — does NOT reflect 2025-26 mid-decade redraws (inferred). No 2026 CB vintage listed.
- **Census TIGER/Line 2026 — use for districts:** released Oct 14 2026. 56 state files `tl_2026_XX_cd120.zip` dated 2026-10-06 (https://www2.census.gov/geo/tiger/TIGER2026/CD/). No national file. Tech doc: 120th Congress districts for the 2026 cycle; new plans in **AL, CA, FL, LA, MO, NC, OH, TN, TX, UT** (https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2026/TGRSHP2026_TechDoc.pdf). Full resolution → simplify with mapshaper/topojson-simplify, merge to one TopoJSON at build.
- **Missouri conflict:** TIGER 2026 lists MO as redrawn, but MO Supreme Court ruled 7-0 on Sept 3 2026 that HB 1 cannot be used in November; 2022 map governs; HB 1 is a Nov 3 referendum (https://www.ksmu.org/news/2026-09-03/... ; https://news.ballotpedia.org/2026/09/09/...). SCOTUS reportedly let it stand. **Take MO districts from the 119th (cb_2025) file; verify before launch.**
- **Other states (PolicyMap tracker, statuses Sept 25-28):** TX (PLANC2333), NC, OH, CA (Prop 50) in effect; UT in effect by court order; FL (May 4), TN (May 7), LA (SB 121, May 29, post-*Callais*) in effect but challenged; AL uses 2023 plan (SCOTUS stay June 2 2026); VA map never took effect (2021 court map stands); GA/NY 2024 redraws already in 119th files. Not re-checked for October changes.
- **react-simple-maps** 5.0.5 (v5 on 2026-08-28; MIT; peer React 19; 96 kB / 33 kB gzip). Just revived after dormancy; no v5 release notes found. Plain **d3-geo** (37 kB / 13 kB gzip) is lower risk.
- **MapLibre GL** 6.16.0 (296 kB gzip), deck.gl 9.4.1, react-map-gl 8.1.3 — current but overkill.
- **Hex cartogram:** Daily Kos 2022 congressional hexmap is latest (https://www.dailykos.com/stories/2022/9/20/2122648/...). Downloads (shapefile, SVG, PNG) via Google Sheet in post. No formal license: "You are free to use the maps as you wish", cite + link https://dkel.ec/map. Hex positions are per district number; 435 count unchanged → hexes should not move on redistricting (inference). No 2026 hexmap or open GeoJSON hex source found.
- `unitedstates/districts` is CC0 but 2012 set. Redistricting Data Hub: free account, 2026 plans unconfirmed.

## 4. Live-update patterns

- **NumberFlow:** `@number-flow/react` 0.6.2 (2026-07-18), MIT, 6 kB gzip, peer React 18/19 (https://number-flow.barvian.me/). Intl formatting, `trend`, `NumberFlowGroup`, `continuous` plugin, `respectMotionPreference` default true, SSR/CSP nonce. No RTL / non-Latin digits.
- **react-countup** 6.5.3 last updated 2024-11-17 → prefer NumberFlow.
- **TanStack Query** 5.105.0: `refetchInterval` independent of `staleTime`; structural sharing on by default (unchanged data keeps references). `experimental_streamedQuery` for AsyncIterable. SSE: simpler to use `EventSource` + `queryClient.setQueryData`. `refetchIntervalInBackground` default unconfirmed.
- **motion** 14.9.0: `layout` prop animates reorders via transforms (~12 kB). Inline elements won't animate; scroll containers need `layoutScroll`; border changes hurt perf.
- **Live regions** (MDN aria-live): render empty at load; `polite`; for fast tickers use `off` + batched announcements; `aria-busy` during bulk updates. Pattern: visually hidden polite region updated only on race calls / control changes ("Senate: R 51, D 49, 3 uncalled"); animated digits outside it.

## Could not verify
Paid template pricing; Recharts v3 re-render/hydration; Tremor Raw vs npm; October 2026 court rulings on maps; Missouri final status; Daily Kos license text; motion reduced-motion docs; per-library Next 16 / React 19 compat beyond peer ranges (`next` 16.4.3, `react` 19.3.1 current).
