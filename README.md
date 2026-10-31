# Big Board — 2026 Midterm Election Tracker

> What if Steve Kornacki was an application? A live-updating, free-data election dashboard for the Nov 3, 2026 US midterms: Senate, House (all 435), governors, ballot measures and state legislatures, with county-level expected-vote analysis.

**Stack:** Next.js 16 (Cache Components) · React 19 · shadcn/ui + Tailwind v4 · Recharts 3 · d3-geo/TopoJSON · TanStack Query · Upstash Redis · Vercel.

See [docs/PLAN.md](docs/PLAN.md) for the architecture and [docs/research/](docs/research/) for the sourced research behind every decision.

## How it works

```
cron (1/min) → /api/ingest → state/county feed adapters → analytics → Redis snapshot
viewers → Vercel CDN (s-maxage=15, SWR) → /api/results → TanStack Query polling (25s)
```

- **Data tiers:** A = official statewide feed (NC, VA, GA, CA, MN, AK, IA); B = county feeds; C = delayed/community. Shown next to every state.
- **Projections** are our own rule ("Projected · Big Board"), never republished AP/network calls.
- **Expected vote, benchmarks, needs-X%-of-remaining, projection band:** see `/methodology` and `src/analytics/`.

## Develop

```bash
npm install
cp .env.example .env.local        # add Upstash + CRON_SECRET (optional locally: in-memory store)
npm run build:geometry            # TIGER 2026 districts, us-atlas counties, Downballot hexmap → public/data/geo
npm run build:reference           # Wikipedia/FEC/VoteHub/MEDSL → public/data/reference
npm run dev
```

Trigger an ingest locally: `curl "http://localhost:3000/api/ingest?once=1"` (no secret needed outside production).

Tests: `npm test` (analytics, adapters against fixtures, and a full simulated election night that must make zero retracted calls). Typecheck: `npm run typecheck`.

### Rehearse election night
- `npm run sim` — offline run of the whole night (6:45 PM → 2 AM ET) through the real ingest + analytics; prints balance of power, calls, and any retractions. `SIM_SEED=7 npm run sim` for another night.
- `npm run dev:sim` then `SIM_URL=http://localhost:3001 npm run sim:drive` — watch the board play out live in the browser at 60× speed. Every snapshot is labelled SIMULATION.

### Safety rails
- Before a state's polls close, its numbers are zeroed (several states publish test data on their live endpoints).
- Projections need either a mathematically decided count or ≥50% of expected vote with a margin beyond the model band (≥85% in states that count early or Election-Day votes first).

## Deploy (Vercel)

1. Import the repo; add **Upstash for Redis** from the Marketplace (sets `UPSTASH_REDIS_REST_*`).
2. Copy `.env.example` for local use. In Vercel set `CRON_SECRET`, `ADMIN_SECRET`, `FEC_API_KEY` and `NEXT_PUBLIC_SITE_URL` (mark the secrets Sensitive).
3. `vercel.json` schedules `/api/ingest` once a day as a safety net (Hobby-legal). Live updates need a per-minute trigger: Vercel Pro cron, or an external pinger (cron-job.org, QStash) sending `Authorization: Bearer $CRON_SECRET` to `/api/ingest`. See `docs/PINGER.md`.
4. For election-night traffic enable Flat Rate CDN and a Spend Management cap (see docs/research/04).

## Licenses & attribution

Code: MIT. Data: see `/sources` in the app. Cartogram © Daily Kos Elections / The Downballot (CC BY 4.0). Candidate lists and ratings via Wikipedia (CC BY-SA 4.0).
