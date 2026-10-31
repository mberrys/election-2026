# Vercel live-update topology and cost (gap-fill research, fetched 2026-10-30)

## Recommendation: CDN-cached polling on Vercel Pro, not push

**Topology**
1. **Ingest:** Vercel Pro cron runs the ingest route once a minute. The route does two upstream pulls 30s apart in one invocation (Active CPU doesn't bill while sleeping/waiting on I/O). A second trigger (QStash pay-as-you-go or cron-job.org) calls the same route as a backup; make ingest idempotent with a lock.
2. **Snapshot store:** write one snapshot (~30 KB) to an Upstash Redis key. Free tier covers it.
3. **Read path:** Next.js Route Handler (`/api/results`, Node runtime) reads Redis, sets `Cache-Control: public, max-age=5, s-maxage=15, stale-while-revalidate=60`. Staleness stacks (ingest cadence + s-maxage + SWR), so keep s-maxage short. CDN cache is per region, so origin load ≈ 20 regions × 4/min.
4. **Client:** prerendered static shell + TanStack Query `refetchInterval` 30–60s with jitter, no background-tab polling. Prefer this over ISR pages (ISR re-downloads HTML/RSC, larger than JSON).
5. **Plan:** Pro required. Hobby not viable.

**Cost estimate: 50k viewers × 2 polls/min × 6h = 36M requests** (iad1 on-demand; assumes brotli brings 30 KB → ~6 KB + ~1 KB headers — unverified)

| Scenario | Election night | Notes |
|---|---|---|
| **Pro, CDN-cached, on-demand** | ~$110–240 | 36M × $2/M = $72 requests; 252 GB–1.1 TB × $0.15/GB = $38–167 transfer; Pro includes $20 credit |
| Same, 60s polling + hidden-tab pause | ~$55–120 | halves requests |
| **Pro + Flat Rate CDN $100 tier** | ~$120 fixed ($100 + $20 seat) | $100 tier covers 50M requests / 50 TB; $20 tier only 10M requests |
| Functions on every poll (no CDN cache) | ~$250–420 | +36M invocations ($22), ~$13 Active CPU, ~$65 origin transfer, ~$72 Redis PAYG |
| Hobby | Not viable | 1M CDN requests / 100 GB included; 36M is 36× cap; Hobby pauses 30 days when exceeded |
| Redis, QStash, cron-job.org, Blob | $0 | within free tiers |

- Realistic traffic is peaky → expect 30–60% of these numbers.
- **Flat Rate CDN** (Pro-only): tier changes take effect next billing cycle; a spike moves you up a tier next cycle rather than overage; Vercel may limit service if "materially above" tier. Enable and size before Nov 3; set Spend Management cap.
- Hobby is non-commercial only (donations OK) — but quota is the blocker regardless.
- Cache hits and 304s still count as CDN Requests. Only fewer polls cut request cost.

## Evidence

**1. Pricing** (vercel.com/docs/pricing, /docs/limits, /docs/pricing/regional-pricing/iad1)
- Hobby: 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1M CDN requests, 1M invocations, 4h Active CPU, 360 GB-hr, 1M ISR reads, 200K ISR writes.
- Pro: $20/dev seat + $20 usage credit; viewer seats free.
- Pro on-demand (iad1): FDT $0.15/GB, CDN requests $2/M, Fast Origin Transfer $0.06/GB, Active CPU $0.128/hr, memory $0.0106/GB-hr, invocations $0.60/M, ISR reads $0.40/M, ISR writes $4/M.
- "Edge Requests" renamed "CDN Requests".

**2. Storage**
- **Upstash Redis free** (upstash.com/pricing/redis): 500K commands/month, 250 MB, 10 GB bandwidth, 10K cmd/s. PAYG $0.20/100K. (upstash.com page, not Marketplace listing — verify.)
- **Vercel Blob**: CDN-cached; minimum `cacheControlMaxAge` 60s (docs: "for faster updates use a function"). Poor fit for 30s cadence unless immutable `snap-<ts>.json` + pointer via route. Blob transfer $0.05/GB but each access is still a CDN request.
- **Global Config (ex-Edge Config)**: 1 MB/store; writes up to 10s to propagate; docs say avoid for frequently updated data; Hobby 100 writes/month, Pro $1/100 writes. Not recommended.
- **Neon free**: 1 GB, 100 CU-hours. Fine for history, not hot path.

**3. Push options**
- **Ably**: free 200 conns / 6M msgs/mo; Standard $29 (10K conns); Pro $399 (50K conns); $2.50/M msgs + $1/M connection-minutes. 50k viewers @30s ≈ $510–540.
- **Pusher**: sandbox 100 conns / 200K msgs/day; largest self-serve $1,199 for 30K conns; 50k = Enterprise.
- **Supabase Realtime Pro**: 500 conns incl.; +$10/1,000 conns; $2.50/M msgs after 5M; cap 10K without spend cap. ~$600 if allowed.
- **Cloudflare Durable Objects**: outgoing WS messages free, incoming 20:1; plausibly <$20 but needs sharding/custom engineering; per-object connection ceiling unverified.
- **Conclusion:** push at 50k ≈ $500+ and ~10× complexity. CDN polling wins unless <15s latency needed.

**4. SSE/WebSockets on Vercel**
- Streaming works; connection ends at max duration (Hobby 300s, Pro 800s / 1800s beta). Active CPU doesn't bill idle; Provisioned Memory bills while any request in flight; each reconnect = invocation.
- Vercel realtime guide: managed provider for high fan-out; polling fine for infrequent updates.
- Vercel WebSockets public beta since 2026-06-22; per-instance connection count undocumented.
- Viable technically; not recommended here.

**5. Schedulers**
- **QStash**: free 1,000 msgs/day + 10 schedules (1/min = 1,440/day exceeds free → enable only for event window); PAYG $1/100K ≈ $0.43/mo at 1/min; 1-minute minimum.
- **GitHub Actions**: 5-min minimum, delayed under load, jobs may drop. Unsuitable.
- **cron-job.org**: free, 1-min minimum, no punctuality guarantee, 30s timeout (return early + `after()`/`waitUntil`), auto-disables after 25 consecutive failures.
- **Best:** Vercel Pro cron primary (1/min) + QStash PAYG backup; handle 30s cadence inside the route.

**6. Pattern and templates**
- `s-maxage` + `stale-while-revalidate` on Route Handler documented (/docs/caching/cache-control-headers, /docs/caching/cdn-cache). Need `s-maxage=N` to cache function responses.
- With only `Cache-Control`, CDN strips `s-maxage`/SWR before browser; set `Vercel-CDN-Cache-Control` to give browser a separate `max-age`.
- No `Set-Cookie` or `Vary: Cookie` (uncacheable).
- Cache entries regional; rarely requested entries may be evicted.
- Next.js GET handlers dynamic by default since v15. `cacheComponents` interaction on Next 16 not verified.
- **Precedent:** no Vercel template for live scores/elections. Washington Post case study: ISR for 1,000+ races across 52 pages; earlier websocket approach for the House page was "lagging like crazy".

## Unverified
5× JSON compression; Flat Rate CDN overage on included tier; Durable Objects per-object limits; Marketplace Upstash plan parity; sub-minute QStash; SSE cost per connection; `cacheComponents` + Route Handler headers on Next 16.
