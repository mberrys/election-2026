# Next.js 16.4 cheat-sheet for this repo (from bundled docs, 2026-10-30)

`next.config.ts` has `cacheComponents: true` + `partialPrefetching: true`. Keep both.

## Hard rules
- **Never export** `dynamic`, `revalidate`, `fetchCache`, `dynamicParams`, `experimental_ppr`, or `runtime` from pages/routes — build errors under Cache Components. `maxDuration` is fine. 16.4 adds `ensureStatic = 'navigation'` to lock a page static.
- Anything awaiting uncached async work (fetch, Redis, `await readFile` in a component body) must sit inside `'use cache'` or `<Suspense>`; else "blocking-route" error.
- `new Date()`, `Date.now()`, `Math.random()`, `crypto.randomUUID()` during prerender fail the build. Use `await connection()` inside Suspense, `await io()` (16.3+) in server components / `use(io())` in client components, or move to client effects.
- `params`/`searchParams`/`cookies()`/`headers()` are Promises — `await` them. Route ctx type: `RouteContext<'/x/[id]'>`.
- `middleware.ts` → `proxy.ts` (`export function proxy`, Node only).
- `revalidateTag('x', 'max')` (two args). `updateTag` for read-your-writes in Server Actions. `unstable_cache` → `'use cache'` + `cacheLife` + `cacheTag`.
- `next lint` removed; `"lint": "eslint"`. Turbopack default; custom webpack needs `--webpack`.
- `fetch` is uncached by default; cached only inside `'use cache'`. GET fetches memoized per render pass.

## Route Handlers
- Reading Redis / `request.headers` / `request.url` makes a GET request-time automatically. No `'use cache'` inside handler body (extract to helper).
- Set response headers on the returned `Response`. Docs don't promise handler `Cache-Control` survives — **verify with `next build && next start` + `curl -i`**.
- `after()` from `next/server` runs post-response work, bounded by `maxDuration`.
- Cron: `vercel.json` `{"crons":[{"path":"/api/ingest","schedule":"* * * * *"}]}`; Vercel sends `Authorization: Bearer $CRON_SECRET`. Per-minute needs Pro.

## Static shell + client island
- Static `import data from '@/data/x.json'` is prerendered. `fs.readFileSync` at module scope OK.
- Client island: `'use client'` + TanStack `useQuery({ refetchInterval })`; `useQuery` is fine under prerender (renders pending state). Wrap in `<Suspense>` only for `useSuspenseQuery`.
- QueryClient: new per server render; module-level singleton in browser.
- `generateMetadata` with uncached fetch on a static page errors — use `'use cache'` or static `metadata`.

## `use cache`
- `cacheLife(...)` inside the scope, always explicit. Custom profile in config: `cacheLife: { live: { stale: 30, revalidate: 15, expire: 300 } }`.
- Short lifetimes (`revalidate: 0`, `expire` < 300s, `stale` < 30s) become dynamic holes → need Suspense.
- Plain `use cache` is per-instance in-memory on Vercel; `'use cache: remote'` shares across instances (handler supplied by host; unverified). For this app: Redis + CDN headers on `/api/results`; `use cache` only for build-time/static-shell data.
