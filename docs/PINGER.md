# 30-second updates on Vercel Hobby (external pinger)

Vercel Hobby only allows **once-a-day** cron jobs (a deployment with a more frequent `crons` entry fails), so the
live updates are driven by a free external scheduler instead:

```
cron-job.org (every 1 min) ──► GET /api/ingest  (Authorization: Bearer $CRON_SECRET)
                                 ├─ pull #1 now          → snapshot ~:00 (+ pull time, ~10–15 s)
                                 ├─ pull #2 at +30 s     → snapshot ~:30
                                 └─ generic ballot refresh if older than 30 min
```

`vercel.json` keeps one **daily** cron (12:17 UTC) as a safety net; it is Hobby-legal.

## Set up cron-job.org (free, 1-minute minimum)

1. Generate a secret and add it in Vercel → Project → Settings → Environment Variables as `CRON_SECRET`
   (Production). Redeploy so the function sees it.
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
2. Create a free account at https://cron-job.org and **Create cronjob**:
   - **URL:** `https://<your-deployment>/api/ingest`
   - **Schedule:** every 1 minute
   - **Advanced → Headers:** `Authorization: Bearer <CRON_SECRET>`
     (the secret is only accepted in this header, never in the URL, so it stays out of request logs)
   - **Advanced → Timeout:** 30 s (the route answers after the first pull, ~10–15 s)
   - **Notifications:** on failure, and when the job gets disabled
3. Click **Test run** → expect HTTP 200 and `"ok": true, "nextPullsIn": [30000]`.

cron-job.org does not guarantee punctuality and **auto-disables a job after 25 consecutive failures** — keep the
failure email on, and check `/api/health` (`snapshotAgeSec` should stay under ~45).

## Backup trigger (recommended on election night)

Add a second scheduler pointing at the same URL; the Redis lock makes duplicate triggers harmless.

- **Upstash QStash** (same Upstash account as the Redis store): Schedules → cron `* * * * *`, destination
  `https://<your-deployment>/api/ingest`, header `Authorization: Bearer <CRON_SECRET>`. Free tier is 1,000
  messages/day (a 1-minute schedule is 1,440/day), so either enable it only for Nov 3–4 or use pay-as-you-go
  (~$0.43/month at this rate).
- GitHub Actions cron is **not** suitable (5-minute minimum, routinely delayed).

## Knobs (env vars)

| Var | Default | Meaning |
|---|---|---|
| `INGEST_PULLS_PER_RUN` | 2 | pulls per trigger (max 4) |
| `INGEST_PULL_GAP_MS` | 30000 | spacing between pulls, from the start of the call (min 10000) |

`2 × 30000` with a 1-minute pinger = a fresh snapshot every 30 s. `4 × 15000` would give 15 s, at four times
the upstream load on state election servers — not recommended.

## What Hobby can and can't carry

| | Hobby limit | This app |
|---|---|---|
| Function invocations | 1M / month | ~2,900/day from ingest |
| Function duration | 300 s | ingest call ≈ 45 s (two pulls) |
| **CDN requests** | **1M / month** | every viewer polls `/api/results` every ~25 s ≈ **144 requests per viewer-hour** |

1M CDN requests ≈ **7,000 viewer-hours** (e.g. 1,000 people for 7 hours). Exceeding a Hobby limit **pauses the
project**. Fine for you and a small audience; for anything public, move to Pro before Nov 3.
