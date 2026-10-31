# Big Board — 2026 Midterm Election Tracker

> "What if Steve Kornacki was an application?" — a live-updating, free-data, Kornacki-style election dashboard for the Nov 3, 2026 US midterms, deployed on Vercel.

Written 2026-10-30 from the research in [docs/research/](research/). **Election night is in 4 days.** The plan is phased so a credible product ships before polls close, with live coverage widening as adapters land.

---

## 1. Constraints that shape everything

| Constraint | Source | Consequence |
|---|---|---|
| **No AP / DDHQ license.** Both are paid, OAuth-gated. | research/01 | We compute our own projections from official state/county feeds and label them as projections. We never republish AP calls. |
| **NYT's results JSON is live and CORS-open but its ToS forbids scraping/redistribution.** | research/06 | Not a data source for the product. At most an opt-in, off-by-default private cross-check (`ENABLE_NYT_XCHECK`). |
| **Only ~7 states have verified open statewide machine-readable feeds today:** NC, VA, GA (Enhanced Voting), CA, MN, AK, IA (Clarity). PA/AZ/TX/NV/OH/WI/NY/NH block bots at the state level; many of their counties are open (EV, Clarity, CSV). | research/06 | Live coverage is **tiered by state**, shown truthfully in the UI. House "all 435" is covered pre-election (ratings, polls, money, maps) for every seat; live vote counts flow only where feeds exist, expanding county-by-county. |
| **Vercel Hobby: cron once/day, 1M CDN requests/month, pauses for 30 days if exceeded.** Pro: cron 1/min, $20 + usage. | research/01, 04 | Ingest trigger is pluggable (Vercel cron on Pro, cron-job.org/QStash on Hobby). Read path is CDN-cached JSON polled by the client, never per-viewer functions. **Recommend Pro + Flat Rate CDN $100 tier for election night.** |
| **Push (Ably/Pusher/Supabase) costs $500+ at 50k viewers.** | research/04 | CDN-cached polling at 20–30s. No websockets. |
| **Redistricting:** TIGER 2026 `cd120` has the 2026 maps for AL, CA, FL, LA, NC, OH, TN, TX, UT. Missouri's new map was struck (use 2022 lines). | research/03 | District geometry built from TIGER 2026 at build time, with MO patched from cb_2025 cd119. |
| **Licensing of pre-election data:** Wikipedia CC BY-SA, VoteHub CC BY, Rio Times data room CC BY, FEC/Census/MEDSL public domain or CC0, Daily Kos hexmap attribution-required, UF Election Lab CC BY-NC-ND (link-out only), Ballotpedia paid (link-out only). | research/02 | Attribution footer per panel; share-alike data kept in separately licensed JSON. |

---

## 2. Product: what the Big Board shows

Six screens, one persistent header (balance of power + clock + "last updated" + data-tier badge).

### 2.1 National board (`/`)
- **Balance-of-power bars** — Senate (100, majority 51/50+VP) and House (435, majority 218). Segments: called D / leaning D / uncalled / leaning R / called R. Numbers animate (NumberFlow). Seats-needed callouts.
- **Governors strip** — 36 races, tiles by status.
- **Hex cartogram of all 435 districts** (Daily Kos 2022 layout) colored by status/margin, hover for race card.
- **Key races board** — Senate toss-ups (AK, IA, KS, ME, OH-special, TX, plus GA, NC, MI, NH), 15 House toss-ups, competitive governors. Each row: candidates, % in, margin, benchmark, "needs X% of remaining", mirage badge, status.
- **Poll-closing timeline** — horizontal timeline 6pm–1am ET; states light up as they close.
- **Live-region** (visually hidden) announcing only calls and control changes.

### 2.2 Senate (`/senate`)
- Path-to-majority tracker: seats locked, seats needed, each party's remaining paths ranked by consensus rating.
- 35-race table with ratings (Cook/Inside/Sabato median via Wikipedia), poll average (VoteHub), FEC cash on hand, live margin.
- State detail drill (`/senate/[state]`).

### 2.3 House (`/house`)
- District hexmap + sortable 435-row table (filters: rating, state, status, flip watch).
- Generic-ballot panel (Rio Times 5-average + VoteHub polls) vs 2024 baseline.
- "Seats to watch" grouped by poll-closing hour.

### 2.4 Governors (`/governors`) and Ballot measures / State legislatures (`/states`)
- Governors: 36 tiles + table. States: chamber-control grid (Wikipedia 2026 state legislative elections article), ballot-measure list with links to Ballotpedia; live measure results where state feeds carry them (CA `/ballot-measures`, NC, VA, GA).

### 2.5 State board (`/state/[st]`) — the Kornacki screen
- **County map** (us-atlas 10m) colored by **swing vs 2024** (diverging scale centered on 0), opacity = % expected vote in.
- **County table**: expected vote, % in, current margin, 2024 margin, benchmark margin, over/under, needs X% of remainder, vote-mode flags.
- **"What's left" bars** per county (counted vs est. remaining, stacked by mode where known).
- **Bellwether watchlist** — top 8 counties by how closely their 2024 lean tracked statewide, auto-derived.
- **Mirage badge** — which vote modes have reported so far (from feed fields: NC `evc/ovc/avc/pvc`, AK method split, EV turnout, else state calendar table).
- **Needle-lite**: projected final margin with a widening/narrowing band from the simplified cluster-residual model (research/05), explicitly labeled "model, not a call".

### 2.6 Methodology (`/methodology`) and Sources (`/sources`)
- How expected vote, benchmarks, projections and "called" status are computed; every data source with license and refresh cadence; tier legend.

---

## 3. Architecture

```
                 ┌──────────────── Ingest (every 60s; 2 pulls/invocation) ────────────────┐
 Trigger ───────►│ /api/ingest (Node route, 300s max)                                      │
 Vercel Pro cron │   adapters/*.ts  → normalize → merge → analytics → snapshot.json        │
 or cron-job.org │   lock in Redis; idempotent; per-adapter timeout + circuit breaker       │
 or QStash       └───────────────┬──────────────────────────────────────────────────────────┘
                                 ▼
                      Upstash Redis (Vercel Marketplace, free tier)
                      keys: snap:latest (≈30–60 KB gz), snap:state:{ST}, snap:history:{ts} (ring)
                                 ▼
 Viewers ◄── Vercel CDN ◄── /api/results[?scope=national|senate|house|state:NC]
 (TanStack Query,         Cache-Control: public, max-age=5, s-maxage=15, stale-while-revalidate=60
  25s ±5s jitter,         Vercel-CDN-Cache-Control: s-maxage=15
  paused in bg tabs)      ETag → 304s
                                 ▲
                 Static shell (prerendered RSC) + build-time JSON: geometry, candidates,
                 ratings, baselines, FEC, polls (refreshed by a separate /api/ingest-slow
                 every 30 min: Wikipedia ratings, VoteHub, Rio Times, FEC)
```

**Why this shape:** origin load is bounded by CDN regions × cache TTL, not by viewers; Hobby→Pro is a config change; every adapter failure degrades one state, not the board.

### 3.1 Stack (versions verified 2026-10-30)
- **Next.js 16.4 / React 19.3**, App Router, TypeScript strict, `pnpm`.
- **shadcn/ui** (CLI 4.23, Base UI default) + **Tailwind v4** + `tw-animate-css`. Dark-first theme, Kornacki palette: D `#2E6FD1`, R `#D33F3F`, I/other `#9A7B2E`, uncalled slate, "lean" tints at 55% alpha.
- **Charts:** shadcn Charts (Recharts 3.10, `isAnimationActive={false}` on live charts); bespoke SVG via `d3-scale`/`d3-shape`/`@visx/*` for gauges, swing arrows, hexmap.
- **Maps:** `d3-geo` + `topojson-client` SVG rendered in RSC; `us-atlas` counties-10m; districts TopoJSON built from TIGER 2026 `cd120` via `mapshaper` at build.
- **Live UI:** TanStack Query 5.105, `@number-flow/react` 0.6, `motion` 14.9 `layout` for sorted tables.
- **Storage:** Upstash Redis (Marketplace). No Postgres on the hot path; optional Neon for post-election archive.
- **Validation:** `zod` schemas per adapter output; snapshot schema versioned.
- **Testing:** Vitest for analytics + adapters (fixture files from 2024 feeds), Playwright smoke for the board.
- **Tooling:** ESLint 9 flat config, Prettier, Husky pre-commit.

### 3.2 Data adapters (`src/data/adapters/`)
Each adapter: `fetch(ctx) → RawFeed`, `normalize(raw) → Race[]`, declares `tier`, `cadence`, `license`, `coverage`.

| Adapter | Covers | Tier |
|---|---|---|
| `nc-ncsbe` | NC statewide, precinct counts, vote-method split | **A** (verified, statewide, JSON) |
| `enhanced-voting` (generic) | VA, GA statewide; AZ/MI/NY/OH/TX/CA counties via `export-*.json` | **A** state / **B** county |
| `ca-sos` | CA governor, ballot measures, status; `us-rep` when fixed | **A** |
| `mn-sos` | MN `allracesbyprecinct.txt` | **A** |
| `ak-doe` | AK precinct CSV with reporting flag | **A** |
| `clarity` (generic, port of `clarify` logic) | IA statewide; AZ Pinal, PA Allegheny, TX/NJ/MI/KS counties | **A** IA / **B** counties |
| `fl-watch` | FL `floridaelectionwatch.gov` HTML | **B** (HTML scrape) |
| `maricopa-txt`, `harris-json`, `franklin-api`, `philly`, `montco-csv` | Big-county fillers for AZ/TX/OH/PA | **B** |
| `wikipedia-results` | Hand-edited tables for states with no open feed (PA/NV/NH/WI/ME statewide) | **C** (delayed, attribution) |
| `nyt-xcheck` | Off by default; private comparison only, never rendered | — |

Tier is shown per state in the UI ("Live: official feed", "Live: county feeds, partial", "Delayed: community-edited").

### 3.3 Pre-election / reference data (`src/data/reference/`, built at deploy + refreshed every 30 min)
- **Candidates:** FEC `/candidates` (2026, H/S) + Wikipedia race tables; governors from Wikipedia.
- **Ratings:** Wikipedia ratings tables (Cook, Inside, Sabato, + others) → median consensus; Rio Times data room CSV as cross-check.
- **Polls:** VoteHub API (generic ballot, race polls where present); Rio Times generic-ballot average.
- **Money:** FEC `/candidate/{id}/totals`, `schedule_e/by_candidate`.
- **Baselines:** MEDSL county presidential 2000–2024 (CC0), House 1976–2024; tonmcg 2024 county CSV as fallback; Downballot 2024-pres-by-2026-CD sheet.
- **Geometry:** us-atlas counties; TIGER 2026 cd120 (MO patched from cb_2025 cd119); Daily Kos 2022 hexmap positions.
- **Calendar:** poll-closing table (Green Papers/270toWin, hand-verified), GA runoff Dec 1, Senate specials OH & FL, vote-mode order by state (research/05 table, verified before launch).

### 3.4 Analytics (`src/analytics/`, pure functions, unit-tested)
- `expectedVote(county)` — AP-style proxy: `max(votesIn, baselineTurnout × turnoutAdj, early + edEst)`; precincts-only fallback `votesIn × (1−p)/p`, p clamped ≤ 0.95; never shows 100% until the feed flags complete.
- `benchmark(county, stateExpectedMargin)` — uniform swing from 2024; 538-style tie-margin.
- `needsOfRemaining(race|county)` — `(targetMargin × EV − marginVotesNow) / remaining`; flags impossible (>100%).
- `projectState(race)` — cluster-residual blend (urban/suburban/rural × region), mode-adjusted, band shrinks with % in. Labeled model.
- `callStatus(race)` — our projection rule: leader margin > max(2%, modelBand) AND remaining < margin AND ≥ 1 feed tick stable → "Projected (Big Board)". Separate from any external call.
- `balanceOfPower(races, ratings)` — called + leaning buckets; seats-needed; Senate paths.
- `bellwethers(state)` — rank counties by |county lean − state lean| across 2020/2024.

---

## 4. Phases

### Phase 0 — Scaffold (today)
- `create-next-app@latest` (TS, Tailwind, App Router, Turbopack), shadcn init (Base UI, dark), tokens, layout shell, Vercel project + Upstash Redis via Marketplace, env schema, CI (typecheck, lint, test).
- Build pipeline: `scripts/build-geometry.ts` (TIGER download → mapshaper → TopoJSON), `scripts/build-reference.ts` (FEC, Wikipedia, VoteHub, Rio Times, MEDSL → `public/data/*.json`).

### Phase 1 — Pre-election board (ship by Oct 31)
- National board with ratings-based balance of power, hexmap, key races, generic ballot, poll-closing timeline. Senate/House/Governors/States pages from reference data. Methodology + Sources pages. Deployed to Vercel with a domain.

### Phase 2 — Live core (Nov 1–2)
- Snapshot schema, ingest route + lock, Redis, `/api/results` with CDN headers, TanStack polling, NumberFlow, live-region.
- Tier-A adapters: NC, VA, GA, CA, MN, AK, IA. Fixtures from 2024 feeds; replay harness (`pnpm replay --speed 60`) to rehearse election night offline.
- Analytics v1: expected vote, benchmarks, needs-X%, call status, BoP from live + ratings.
- State board for NC, GA, VA, IA, AK, MN, CA.

### Phase 3 — Breadth + Kornacki polish (Nov 2–3, continues election night)
- Tier-B county adapters: Maricopa/Pima/Pinal (AZ), Harris + Clarity counties (TX), Allegheny/Philly/Montco (PA), Cuyahoga/Franklin (OH), Wayne + EV counties (MI), FL HTML.
- Wikipedia tier-C fallback for uncovered statewide races.
- Projection band, mirage badges, bellwether watchlist, "what's left" bars.
- Load rehearsal (k6 against CDN), Spend Management cap, Flat Rate CDN tier, status page banner for feed outages.

### Phase 4 — Post-election
- Freeze snapshots to Neon/Blob; "replay the night" scrubber; GA runoff (Dec 1) mode; certified-results reconciliation from OpenElections.

---

## 5. Repo layout

```
election-2026/
├─ app/                      # Next.js App Router
│  ├─ (board)/page.tsx       # national board
│  ├─ senate/ house/ governors/ states/ state/[st]/ methodology/ sources/
│  └─ api/ ingest/ ingest-slow/ results/ health/
├─ src/
│  ├─ components/ (ui/ from shadcn, board/, charts/, maps/)
│  ├─ data/ adapters/ reference/ schema/ snapshot.ts
│  ├─ analytics/
│  ├─ lib/ (redis, cache headers, time, format)
│  └─ theme/
├─ scripts/ build-geometry.ts build-reference.ts replay.ts
├─ fixtures/ 2024/{nc,va,ga,ca,mn,ak,ia}/...
├─ public/data/ (built JSON: geometry, reference)
├─ docs/ PLAN.md research/
└─ tests/
```

---

## 6. Open risks (tracked in the Sources page)
1. GA 2026 election slug not yet resolvable (404 today) — poll `/results/public/api/elections/Georgia` on Nov 2–3.
2. CO Clarity general-election ID not yet created.
3. CA `/returns/us-rep` returned 500 — may be pre-election; fallback to county EV exports.
4. PA statewide JSON exists but endpoints unknown — needs a browser session to capture; else county adapters + Wikipedia.
5. Vote-mode order table and poll-closing times are from memory/secondary sources — verify against Green Papers / state sites before Nov 3.
6. Missouri district geometry: confirm 2022 lines in force.
7. Vercel Pro upgrade is needed for cron and traffic; Hobby path uses cron-job.org and stays under 1M CDN requests only for small audiences.
