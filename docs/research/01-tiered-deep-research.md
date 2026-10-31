# Deep research (tiered) — verified findings

_Run 2026-10-30. 103 agents, 21 sources, 92 claims extracted, 25 verified (21 confirmed / 4 refuted)._

## Summary

The verified evidence supports a free-sources architecture only in parts. For live election-night results, the only verified free ingestion path is scraping state/county Clarity (Scytl/SOE) election-night sites via the maintained OpenElections `clarify` Python library (parses detail.xml only; you fetch and unzip yourself) or the unmaintained Washington Post `elex-clarity` CLI, while DDHQ's Results API is OAuth-gated and commercially licensed and OpenElections only provides certified post-election CSVs useful as 2022/2024 baselines. On Vercel, Hobby allows 300s functions but caps cron at once per day, so election-night polling needs Pro cron, an external scheduler, or request-driven refresh; Next.js 16 Cache Components give a 1s-revalidate `seconds` profile that renders as a dynamic hole, and `revalidateTag`/`revalidatePath` are lazy stale-while-revalidate operations, so a client-side poll or push layer is still required for live numbers. Supabase Realtime Free (200 connections, 100 msg/s) cannot serve a public dashboard's fan-out. For pre-election context, the Rio Times data room offers CC BY 4.0 CSV/JSON with a five-average generic ballot (D+8.9 as of 30 Oct 2026) and median Cook/Inside/Sabato ratings (6 Senate and 15 House toss-ups), and the NYT needle's benchmark-then-update design is the model for Kornacki-style "expected vote" analytics. Nothing survived verification on the design-system/chart-stack question, FEC/Census/Civic APIs, or county-geometry sources, so those remain unresearched.

## Findings

### 1. The only verified free path to near-live election-night results is parsing Clarity/Scytl (SOE Software) election-night reporting sites used by many states and counties.

**Confidence:** medium · **Votes:** 13: 3-0, 14: 3-0, 1: 3-0, 0: 2-1

The only verified free path to near-live election-night results is parsing Clarity/Scytl (SOE Software) election-night reporting sites used by many states and counties. Two open-source parsers exist: OpenElections' `clarify` (pip install clarify; releases through 0.7.0 on 2025-05-24, Python 3.8-3.12) discovers the detail XML zip URL for a state/county/city Clarity results page and parses contests, jurisdictions, results and choices, but does not download or unzip the zips (which also contain CSV/XLS), so an ingest pipeline must handle fetch+unzip itself. The Washington Post's `elex-clarity` CLI (MIT, latest 0.0.9 on 2022-12-06, no commits since) fetches and formats Clarity results from a site or local file but is unmaintained and untested against 2026 Clarity changes.

_Evidence:_ Clarify README: 'Discover and parse results for jurisdictions that use Clarity-based election systems' and 'Clarify does not download or unzip files.' PyPI confirms 0.7.0 (May 2025) maintained by Derek Willis/OpenElections. elex-clarity PyPI metadata: version 0.0.9, uploaded Dec 6 2022, MIT; GitHub shows no commits after that date. Verifiers could not confirm which 2026 jurisdictions still serve Clarity detail.xml, and the tools' licenses do not settle terms of use of the Clarity data itself. Merged claims 0, 1, 13, 14.

Sources:
- https://github.com/ghing/clarify
- https://github.com/openelections/clarify
- https://pypi.org/project/clarify/
- https://pypi.org/project/elex-clarity
- https://github.com/washingtonpost/elex-clarity

### 2. Decision Desk HQ is not a free data source.

**Confidence:** high · **Votes:** 2: 3-0, 15: 3-0

Decision Desk HQ is not a free data source. Its Results API uses a client-credentials OAuth flow (POST /api/v4/oauth/token with client_id/client_secret), endpoints are scope-gated (forecast endpoints require 'read' and 'forecast' scopes; vote history requires 'read'), there is no public signup or pricing, and the products page describes API/embed delivery of 100,000+ elections per year as a client-licensed commercial product with 'Contact us' as the only path. A free-sources-only tracker must exclude DDHQ.

_Evidence:_ Official DDHQ docs: 'Forecast endpoints require the read and forecast scopes'; token endpoint security scheme: 'Obtain a token from the /api/v4/oauth/token endpoint using your client_id and client_secret.' Products page: 'Delivered via API or embed' for '100,000+ elections per year, from president to local school board', no pricing or free tier; FAQ says API docs are 'provided to clients'. Note the cited roadmap URL redirects and does not itself contain the quote; the quote is on sibling pages of the same docs site. A free developer tier could not be fully ruled out, only inferred absent. Merged claims 2 and 15.

Sources:
- https://results-api-docs.decisiondeskhq.com/changelog/roadmap
- https://ddhq-election-results.readme.io
- https://ddhq.io/products
- https://ddhq.io/faq

### 3. OpenElections (136 GitHub repositories) publishes standardized, pre-processed CSV files of certified results in per-state 'openelections-data-XX' repos for all 50 states plus DC, with original official files in separate 'openelections-sources-XX' repos for roughly 38 states.

**Confidence:** high · **Votes:** 3-0

OpenElections (136 GitHub repositories) publishes standardized, pre-processed CSV files of certified results in per-state 'openelections-data-XX' repos for all 50 states plus DC, with original official files in separate 'openelections-sources-XX' repos for roughly 38 states. Repos remain active (e.g. CA pushed 2026-10-26, TX 2026-08-22). Coverage varies by state and year (Alaska stops at 2020), and the data is certified post-election results, so it suits 2022/2024 precinct- and county-level baselines for swing-vs-prior-cycle visuals rather than live election-night feeds.

_Evidence:_ GitHub API: public_repos = 136; data repos exist for AK through WY plus DC and 'us'; repo descriptions read 'Pre-processed CSV files of certified election results from Alaska'. A related claim that OpenElections 'cannot serve as a live results feed' was voted down 1-2 on wording, but the verifier evidence for the surviving claim itself notes the data is certified results published after the fact, not live feeds. Claim 3.

Sources:
- https://github.com/openelections
- https://api.github.com/orgs/openelections

### 4. Vercel Hobby plan compute limits with Fluid compute: Functions run up to 300s (default and max) with 2 GB / 1 vCPU; Pro/Enterprise get 300s default, 800s max (GA) and 1800s in beta with per-function config, up to 4 GB / 2 vCPU.

**Confidence:** high · **Votes:** 4: 3-0, 5: 3-0

Vercel Hobby plan compute limits with Fluid compute: Functions run up to 300s (default and max) with 2 GB / 1 vCPU; Pro/Enterprise get 300s default, 800s max (GA) and 1800s in beta with per-function config, up to 4 GB / 2 vCPU. Cron Jobs are capped at 100 per project on every plan, but Hobby crons may fire at most once per day (precision ±59 min) and deployments with more frequent expressions fail, while Pro/Enterprise allow once per minute. Consequently a Hobby deployment can run a 5-minute ingest function but cannot schedule frequent election-night polling via Vercel Cron; that requires Pro, an external scheduler hitting a route handler, or request-triggered refresh.

_Evidence:_ Vercel limits page (updated 2026-09-16): 'Maximum duration: 300s (5 minutes) default and max' for Hobby; cron row 'Cron Jobs (per project) | 100* | 100 | 100'. Cron usage-and-pricing page (updated 2026-07-15): Hobby minimum interval once per day, Pro/Enterprise once per minute, 'Hobby accounts are limited to daily cron jobs'. Lower limits apply if Fluid compute is disabled. Merged claims 4 and 5.

Sources:
- https://vercel.com/docs/limits/overview
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/cron-jobs/usage-and-pricing

### 5. In Next.js 16 Cache Components (cacheComponents: true), time-based revalidation is done with cacheLife inside a 'use cache' scope; the finest built-in profile is 'seconds' (stale 30s, revalidate 1s, expire 60s).

**Confidence:** high · **Votes:** 6: 3-0, 7: 3-0

In Next.js 16 Cache Components (cacheComponents: true), time-based revalidation is done with cacheLife inside a 'use cache' scope; the finest built-in profile is 'seconds' (stale 30s, revalidate 1s, expire 60s). Any cache using 'seconds', revalidate: 0, or expire under 5 minutes is 'short-lived', is excluded from prerenders and becomes a dynamic hole rendered at request time, so a seconds-level results feed must be wrapped in Suspense and will not be part of the static shell; on serverless Vercel, 'use cache: remote' is recommended because the default in-memory cache does not persist across invocations.

_Evidence:_ Revalidating guide (updated 2026-06-25) profile table row '| seconds | 30s | 1s | 60s |' and 'A cache is considered short-lived when it uses the seconds profile, revalidate: 0, or expire under 5 minutes. Short-lived caches are automatically excluded from prerenders and become dynamic holes instead.' cacheLife reference (updated 2026-09-29) confirms 'Of the presets, only seconds falls under any of these thresholds.' Custom inline profiles can go below the presets. Merged claims 6 and 7.

Sources:
- https://nextjs.org/docs/app/getting-started/revalidating
- https://nextjs.org/docs/app/api-reference/functions/cacheLife

### 6. On-demand revalidation in Next.js/Vercel is lazy stale-while-revalidate, not push: revalidateTag(tag, profile) can be called from Server Actions and Route Handlers (so a cron- or webhook-triggered ingest route can mark data stale), it marks the tag stale across every route using it, and with the recommended 'max' profile the next visitor gets stale content while fresh data regenerates in the background; the second argument bounds how long stale content may be served before requests block.

**Confidence:** high · **Votes:** 8: 3-0, 9: 3-0, 10: 3-0

On-demand revalidation in Next.js/Vercel is lazy stale-while-revalidate, not push: revalidateTag(tag, profile) can be called from Server Actions and Route Handlers (so a cron- or webhook-triggered ingest route can mark data stale), it marks the tag stale across every route using it, and with the recommended 'max' profile the next visitor gets stale content while fresh data regenerates in the background; the second argument bounds how long stale content may be served before requests block. revalidatePath from a Route Handler likewise waits for the next visit to regenerate. Neither Vercel nor Next.js documents a propagation time or SLA, so sub-second freshness cannot be assumed and a client-side polling fetch (or a push channel) is required for headline live numbers. The single-argument revalidateTag(tag) form is deprecated and behaves like { expire: 0 }.

_Evidence:_ Next.js guide: 'revalidateTag invalidates cache entries by tag using stale-while-revalidate semantics — stale content is served immediately while fresh content loads in the background' and 'Call revalidateTag in a Server Action or Route Handler.' Vercel KB (updated 2026-10-02): 'A Route Handler call to revalidatePath also waits until the next visit to regenerate the path.' Verifiers noted for election night this means one-request-cycle staleness; updateTag or { expire: 0 } are alternatives. A related claim that time-based ISR wastes invocations was refuted 0-3, so do not cite that rationale. Merged claims 8, 9, 10.

Sources:
- https://nextjs.org/docs/app/getting-started/revalidating
- https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- https://vercel.com/kb/guide/how-to-move-to-on-demand-revalidation
- https://vercel.com/docs/data-cache

### 7. Supabase Realtime's Free plan is unsuitable as the fan-out layer for a public election-night dashboard: it caps a project at 200 concurrent connections (Pro 500; Pro without spend cap and Team 10,000), 100 messages per second and 100 channel joins per second (Pro 500; 2,500 above that), with a 256 KB broadcast payload.

**Confidence:** high · **Votes:** 11: 3-0, 12: 3-0

Supabase Realtime's Free plan is unsuitable as the fan-out layer for a public election-night dashboard: it caps a project at 200 concurrent connections (Pro 500; Pro without spend cap and Team 10,000), 100 messages per second and 100 channel joins per second (Pro 500; 2,500 above that), with a 256 KB broadcast payload. Exceeding the message rate raises a tenant_events error that disconnects clients (supabase-js reconnects when throughput drops). Limits are per-project defaults adjustable via support or upgrade.

_Evidence:_ Official limits table fetched 2026-10-30: 'Concurrent connections | 200 | 500 | 10,000 | 10,000 | 10,000+' and 'Messages per second | 100 | 500 | 2,500 | 2,500 | 2,500+'; limit-errors section: 'Connections will be disconnected if your project is generating too many messages per second.' The inference assumes each viewer opens its own WebSocket, the normal supabase-js pattern. Merged claims 11 and 12.

Sources:
- https://supabase.com/docs/guides/realtime/limits

### 8. The Rio Times 'US Midterms 2026 Data Room' is a free, CC BY 4.0 (credit plus link) convenience aggregate of pre-election context with no API but stable static downloads: a generic-ballot CSV, a race-ratings CSV and a JSON file that adds trend history and Polymarket daily history.

**Confidence:** medium · **Votes:** 16: 3-0, 17: 3-0, 18: 2-1

The Rio Times 'US Midterms 2026 Data Room' is a free, CC BY 4.0 (credit plus link) convenience aggregate of pre-election context with no API but stable static downloads: a generic-ballot CSV, a race-ratings CSV and a JSON file that adds trend history and Polymarket daily history. Its generic ballot is an equal-weight mean of five public averages (DDHQ, FiftyPlusOne, NBC News, RealClearPolitics, Silver Bulletin), excluding any average not updated in 21 days, showing D 51.6 / R 42.7 (D+8.9) as of 29-30 Oct 2026. Its consensus race rating is the median of Cook Political Report, Inside Elections and Sabato's Crystal Ball (relayed via Wikipedia rating tables): 6 Senate toss-ups (AK, IA, KS, ME, OH special, TX), 15 House toss-ups (CA-22, CO-5, FL-14, FL-22, IA-2, KY-6, MI-4, MI-7, MI-10, MT-1, NY-17, OH-7, PA-1, TX-35, VA-1) and 143 House seats rated competitive by at least one forecaster. Averages and ratings refresh every 40 minutes, markets every 20.

_Evidence:_ Page text: 'Downloads: generic-ballot CSV, race-ratings CSV and a JSON file ... License: CC BY 4.0, requiring credit to The Rio Times and a link'; 'Equal-weight mean; an average not updated for 21 days is left out'; 'Consensus rating: the middle of the three forecasters' ratings.' Verifier recomputed the five listed averages to 51.6/42.72 and cross-checked the Senate and House medians against Wikipedia's rating tables, which match. Secondary news-outlet source; CC BY covers only the compilation, not the underlying Cook/RCP/DDHQ inputs; figures are a snapshot that changes daily. Merged claims 16, 17, 18.

Sources:
- https://www.riotimesonline.com/us-midterms-2026-data-room/
- https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_elections
- https://en.wikipedia.org/wiki/2026_United_States_Senate_elections

### 9. PollingSource (pollingsource.com/data.php) is a live, free polling page (polls added hourly, fieldwork through Oct 30 2026) whose race average is the unweighted mean of the last three scientific public polls (fewer if fewer exist), with a rating applied only when the newest poll ended within 30 days.

**Confidence:** medium · **Votes:** 3-0

PollingSource (pollingsource.com/data.php) is a live, free polling page (polls added hourly, fieldwork through Oct 30 2026) whose race average is the unweighted mean of the last three scientific public polls (fewer if fewer exist), with a rating applied only when the newest poll ended within 30 days. It is a simple recency average, not a quality- or sample-weighted model like the old FiveThirtyEight, Silver Bulletin or VoteHub averages, so it should be labeled as such if displayed.

_Evidence:_ Page states 'the unweighted mean of the last three scientific public polls'. Single site self-description; no third-party review found; the page does not define 'scientific' or expose an API, and a companion claim that it does not republish Cook/Sabato/Inside ratings was refuted 0-3, so its rating semantics remain unclear. Claim 19.

Sources:
- https://pollingsource.com/data.php

### 10. The NYT election needle, the reference implementation for Kornacki-style 'expected vote' analysis, starts from a pre-election benchmark for every county (and, per secondary coverage, precinct) built from polls, historical results and demographics, then updates as votes arrive, moving from a pre-election estimate to an in-between modelled estimate and propagating over- or under-performance in reported areas to demographically similar unreported areas.

**Confidence:** medium · **Votes:** 3-0

The NYT election needle, the reference implementation for Kornacki-style 'expected vote' analysis, starts from a pre-election benchmark for every county (and, per secondary coverage, precinct) built from polls, historical results and demographics, then updates as votes arrive, moving from a pre-election estimate to an in-between modelled estimate and propagating over- or under-performance in reported areas to demographically similar unreported areas. This is the pattern to replicate: per-county benchmark margin and expected total vote, percent of expected vote reported, and 'needs X% of remaining' math.

_Evidence:_ Reuters Institute (28 Oct 2024) quoting NYT deputy graphics editor Wilson Andrews: the model starts with a pre-election expectation 'in every part of the country, based on polls and historical results, and on the demographics of these areas', moves 'from a pre-election estimate to an in-between modelled estimate', and outperformance in one county 'might mean outperformance in similar counties'. No statistical detail or NYT methodology page was located; precinct wording and 2026 applicability come from weaker secondary coverage. Claim 20.

Sources:
- https://reutersinstitute.politics.ox.ac.uk/news/moving-needle-how-new-york-times-aims-guide-readers-through-americas-most-uncertain-election

## Caveats

Coverage gaps dominate: no claims survived verification for most of the original research question, including Google Civic Information API, OpenStates, Ballotpedia, Wikipedia tables as structured sources, MIT Election Lab, any state Secretary of State feed other than the generic Clarity platform, county feeds, NYT/AP public JSON endpoints, FEC OpenFEC, TIGER/Census or Daily Kos geometry, early-vote trackers, Cook/Sabato/Inside direct access, the entire design-system and chart-stack question (shadcn/ui, Tremor, visx, Recharts, MapLibre, deck.gl), Vercel KV/Blob/Postgres free tiers, SSE vs polling costs, Pusher/Ably tiers, and how DDHQ/Bloomberg/Guardian implement needle-style visuals. The synthesis therefore cannot recommend a UI stack or a complete free data pipeline. Source weaknesses: the Clarity parsers' compatibility with 2026 Clarity sites is untested and elex-clarity is four years stale; Rio Times is a news aggregator relaying Wikipedia-sourced tables, and its CC BY license does not cover the upstream Cook, RCP, DDHQ or Silver Bulletin terms; PollingSource and the NYT methodology rest on single sources; the DDHQ 'not free' conclusion is inferred from the absence of public pricing. Time-sensitivity: all polling and rating figures are a 29-30 Oct 2026 snapshot; Vercel, Next.js 16 and Supabase limits are from docs dated Jun-Oct 2026 and can change before election night; the Next.js caching findings apply only under cacheComponents: true. Four related claims were refuted and should not be cited (OpenElections 'says nothing about live reporting', time-based ISR 'wastes invocations', DDHQ Votes free sign-up, PollingSource ratings provenance).

## Open questions

- Which 2026 states and large counties actually publish Clarity election-night sites with reachable detail.xml/JSON, what are their terms of use and scrape tolerance, and what free path exists for non-Clarity states (e.g. direct SoS JSON/CSV endpoints in PA, GA, AZ, NV, WI, MI, NC)?
- Is any openly reachable, legally usable near-real-time national results feed available for free (public JSON behind NYT/Google/Wikipedia election pages, or an aggregator republishing AP calls), or must a free tracker accept state-by-state scraping plus race calls via a delay-tolerant source?
- What premade design system and chart/map stack (shadcn/ui vs Tremor vs Mantine; visx/Observable Plot vs Recharts; MapLibre/deck.gl vs SVG hexmaps) best fits a Next.js 16 / React 19 data-dense live dashboard, and what free district/county geometry (TIGER, Daily Kos hex, Census cartographic boundaries) pairs with it?
- Given Hobby's once-daily cron and lazy revalidation, what is the cheapest viable live-update topology for election-night load (Pro cron plus Vercel KV/Blob snapshot with client polling, an external scheduler, or a push provider free tier such as Ably/Pusher), and what would it cost at 10k-100k concurrent viewers?

## Refuted claims (do not cite)

- (1-2) OpenElections is a historical and certified-results archive. The page says nothing about live or election-night reporting, so it cannot serve as a live results feed for Nov 2026. It is best used for baseline data such as 2022 and 2024 precinct-level swing comparisons. — https://github.com/openelections
- (0-3) Time-based ISR can regenerate routes even when underlying data has not changed, so on-demand (event-driven) revalidation is recommended over timers where change events exist. For election night, polling-based regeneration wastes invocations unless results actually change. — https://vercel.com/kb/guide/how-to-move-to-on-demand-revalidation
- (1-2) DDHQ's Votes dashboard offers free sign-up access to live election results, historical data, polling averages, prediction market data and a general election forecast model. — https://ddhq.io/products
- (0-3) The site's race rating is derived from its own poll average and only applies when the newest poll ended within the last 30 days. It does not republish Cook, Sabato or Inside Elections ratings. — https://pollingsource.com/data.php

## Sources fetched

| URL | Quality | Angle | Claims |
|---|---|---|---|
| https://github.com/ghing/clarify | secondary | Live results data sources (election night) | 5 |
| https://pypi.org/project/elex-clarity | primary | Live results data sources (election night) | 4 |
| https://results-api-docs.decisiondeskhq.com/changelog/roadmap | primary | Live results data sources (election night) | 4 |
| https://ddhq.io/products | secondary | Live results data sources (election night) | 5 |
| https://www.civicapi.org/ | unreliable | Live results data sources (election night) | 5 |
| https://github.com/openelections | primary | Live results data sources (election night) | 5 |
| https://www.riotimesonline.com/us-midterms-2026-data-room/ | secondary | Pre-election structured data (polls, ratings, FEC, geometry, baselines) | 5 |
| https://pollingsource.com/data.php | secondary | Pre-election structured data (polls, ratings, FEC, geometry, baselines) | 5 |
| https://electiontracker.live/ | blog | Pre-election structured data (polls, ratings, FEC, geometry, baselines) | 5 |
| https://onpointpolitics.us/maps/early-vote | blog | Pre-election structured data (polls, ratings, FEC, geometry, baselines) | 5 |
| https://www.cnn.com/politics/early-voting-2026-us-midterm-election-vis | unreliable | Pre-election structured data (polls, ratings, FEC, geometry, baselines) | 0 |
| https://electindex.com/ | blog | Pre-election structured data (polls, ratings, FEC, geometry, baselines) | 5 |
| https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026 | blog | Design system and chart stack for Next.js 15 / React 19 | 5 |
| https://www.pkgpulse.com/guides/best-javascript-charting-libraries-2026 | blog | Design system and chart stack for Next.js 15 / React 19 | 5 |
| https://talks.osgeo.org/foss4g-europe-2024-workshops/talk/HF3ZVX/ | secondary | Design system and chart stack for Next.js 15 / React 19 | 4 |
| https://vercel.com/docs/limits/overview | primary | Vercel live-updating architecture and cost under load | 5 |
| https://nextjs.org/docs/app/getting-started/revalidating | primary | Vercel live-updating architecture and cost under load | 5 |
| https://vercel.com/kb/guide/how-to-move-to-on-demand-revalidation | primary | Vercel live-updating architecture and cost under load | 5 |
| https://supabase.com/docs/guides/realtime/limits | primary | Vercel live-updating architecture and cost under load | 5 |
| https://reutersinstitute.politics.ox.ac.uk/news/moving-needle-how-new-york-times-aims-guide-readers-through-americas-most-uncertain-election | secondary | Kornacki-style analytics: expected vote, benchmarks, needles | 5 |
| https://hdsr.mitpress.mit.edu/pub/zr6hjsfl | unreliable | Kornacki-style analytics: expected vote, benchmarks, needles | 0 |
