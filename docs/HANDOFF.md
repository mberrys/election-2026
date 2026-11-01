# Handoff — updated 2026-10-30 ~11:00 PM

## State of the build
Nothing is committed yet (repo has zero commits; user has not asked to commit).

**Verified tonight:** `npx tsc` clean · `npx eslint .` clean · `npm test` 134/134 (analytics, adapters, poll-close gate, full-night simulation) · `SIM_SCENARIO=contested npm run sim` → 0 retractions · `next build` passes (136 pages, static / partial-prerender) · every page curled 200 and screenshotted at desktop; home checked at 375 px (no horizontal scroll).

**Pages:** `/` national board · `/senate` · `/governors` · `/house` · `/states` · `/state/[st]` (51) · `/methodology` · `/sources`. APIs: `/api/results` (CDN + ETag; empty payload now includes a zeroed `balance`), `/api/ingest` (cron 1/min), `/api/ingest-slow` (cron 30 min → Rio Times generic ballot into Redis), `/api/reference`, `/api/health`.

**Live feeds (last real ingest):** NC 15 · VA 15 · CA 67 · MN 10 · AK 3 · IA 6 races. GA waits on the state publishing its Nov 3 election (auto-discovers; `GA_ELECTION_SLUG` overrides).

## Fixed tonight
1. **Alaska feed**: real cause was `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — elections.alaska.gov serves the wrong intermediate cert. Pinned the correct GlobalSign GCC R46 2025 intermediate (`src/data/adapters/certs/index.ts`, expires 2029-06-23) via an undici Agent for that host only (`liveNetwork` ctx flag; tests unaffected). Shared HTTP helper also retries network errors with backoff and reports the error code.
2. **Pre-close test data**: AK and CA publish TEST numbers before Election Day; the board had shown "✓ Projected" for Alaska. New gate (`src/data/election-gate.ts`) zeroes every state until its last poll close (EST on Nov 3) and posts a notice. Overrides: `ALLOW_PRECLOSE_DATA=1`, `ELECTION_DATE`.
3. **Balance of power** counted only races present in the live snapshot (House showed +84/+23). `computeBalance` now walks every seat in the reference list; live results override ratings.
4. **Call stability** — the simulator found 170 retracted projections. Three fixes: (a) a race with no turnout baseline and no precinct progress no longer reads as ~97% in on its first batch (GA-09 was called on 694 votes); (b) when counting outruns the turnout baseline, expected vote re-baselines upward instead of falling back to "votes only"; (c) previous projections are carried into each ingest so the "sticky" rule works. Also: model calls in vote-order ("mirage") states need ≥85% in (WI governor was called R then reversed by late mail). Result: **0 retractions across 4 simulated nights**, enforced by `tests/analytics/simulation.test.ts`.
5. House races get a turnout baseline (state 2024 turnout ÷ districts) in ingest.
6. Smaller: shared `useNow` clock hook (lint fix), `fmtEt` uses the last close for split states, House cartogram viewBox offset, homepage props trimmed (~50 KB gz), BoP labels say "seats (held + won)", deleted `src/app/dev`.

## Election-interference handling (added ~10:45 PM, from Votebeat 10-29 + TIME pieces the user shared)
- **Pauses and challenges**: annotations (`src/data/annotations.ts`, `POST /api/annotations`) show as chips on race cards. Each carries its own context, and `standing: "rejected"` stops a thrown-out challenge from holding back calls. No state is singled out in advance.
- **Annotations** `src/data/annotations.ts` (static, seeded: AK Senate certification suit; CA ~20k and WA ~400 ballot set-aside demands) + **runtime** `POST /api/annotations` (Bearer `ADMIN_SECRET`) for election-night events without a redeploy. `challengedBallots` blocks any projection whose lead is inside the pool; ⚖ flags show on cards, tables and the state board.
- **Stall detection**: race-level (<90% in, no change 45 min, precincts <98%) and county-level for every state with county data ("Fulton County … ~226k outstanding vs a 1,366-vote margin"). Notices flow to the board.
- **Alaska namesakes**: reference build now gives Dan S. Sullivan (incumbent, `sullivan-dan-s`) and Dan J. Sullivan (`sullivan-dan-j`) distinct ids, distinct FEC ids, no shared alias; live AK feed verified to credit each correctly. ⚠ TIME calls Dan J. Sullivan an *independent*; our Wikipedia data and the AK test feed both say R — verify against the AK Division of Elections candidate list.
- **Simulator** `SIM_SCENARIO=contested`: AK Senate finishes D+0.4 with Dan J. drawing ~3% (never called, litigation flag); GA Senate close with Fulton County ballots seized 9:30 PM→1:30 AM (count-paused flag, county stall alert, no call while Collins briefly leads; 0 retractions).
- **In flight**: background builder for AZ / MI / WA live adapters (none of those three has a feed yet). Its report arrives as a notification; integrate, test, and check coverage share of turnout.

## Election-night rehearsal (new)
- `npm run sim` — offline: full ingest at 30-min checkpoints 6:45 PM → 2 AM ET, prints balance + retractions. `SIM_SEED=n` for other nights.
- `npm run dev:sim` (port 3001, 60× speed) + `SIM_URL=http://localhost:3001 npm run sim:drive` — live browser rehearsal. Only one `next dev` can run per folder, so stop the normal dev server first.
- Simulator (`src/data/adapters/simulator.ts`) replaces all real adapters when `SIMULATE=1`; refuses to run on Vercel production unless `SIMULATE_IN_PROD=1`; every snapshot carries a "SIMULATION MODE" notice.

## Next steps (in order)
1. **Deploy** (needs user decisions: Vercel plan, domain): create Vercel project + Upstash Redis (Marketplace), env vars (`CRON_SECRET`, `FEC_API_KEY`, `NEXT_PUBLIC_SITE_URL`), Pro plan for 1/min cron, Flat Rate CDN tier + Spend cap. Then verify on the deployed URL that `/api/results` keeps its `Cache-Control` through the CDN (`curl -I`, look for `x-vercel-cache: HIT`).
2. First commit + GitHub repo (user has not asked yet).
3. Integrate the AZ/MI/WA adapter builder (in flight). Then remaining Tier B: PA (Allegheny/Philly/Montco), TX (Harris + Clarity counties), OH (Cuyahoga/Franklin), WI, NV, NH, ME, FL HTML — docs/research/06.
4. Verify before launch: poll-closing times + vote-order table, Missouri House baselines, SC Senate seat holder, `HOUSE_NATIONAL_MARGIN_2024_DR`, governors `heldBy` (18D/18R).
5. Nice-to-have from builder reports: `CountyMap` `onSelect` prop (keyboard), `RaceCard` `onClick/selected`, StateMeta `tier/feeds` populated from the adapter registry, FEC `--full` for House money.

## Builder reports (all received)
- **Reference data**: MEDSL House dataset blocked by Dataverse guestbook (2024 House margins come from Wikipedia instead); VoteHub generic list stale since 10-09 (Rio Times used for generic ballot); Downballot sheet has old-map Missouri numbers (MO uses 2022 lines in 2026, so likely fine — confirm); Wikipedia lists an appointed SC senator (verify); NC-11 candidate list missing Chuck Edwards upstream.
- **Senate/Governors**: VP party assumed R (`VP_PARTY` in chamber-balance.tsx).
- **House/States**: stateleg ids include `-assembly`, `-legislature` (NE).
- **State board**: uses `instant = false` so unknown states 404 — confirmed it survives `next build`.
