# Free data sources for the 2026 midterm dashboard (gap-fill research, verified 2026-10-30)

Confidence: **V** = primary page fetched. **S** = secondary source only. **U** = unverified or inferred. WebFetch returned 403 for votehub.com, cookpolitical.com, centerforpolitics.org and realclearpolling.com, so those entries rest on search snippets.

## Source table

| Source | URL | Gives | Format | Auth | Limits | License | Conf. |
|---|---|---|---|---|---|---|---|
| OpenFEC | api.open.fec.gov/developers | `/candidates`, `/candidate/{id}/totals`, `/schedules/schedule_e`, committees, filings | JSON REST; bulk files at fec.gov/data/browse-data/?tab=bulk-data | Free api.data.gov key | 1,000 calls/hr per key (S). Max 100 results/page (S). DEMO_KEY ~30/hr, 50/day per IP (S). HTTP 429 over limit. | US federal data, public domain. Contributor names/addresses can't be used for solicitation (U). | V exists; limits S |
| Google Civic Info v2 | developers.google.com/civic-information/docs/v2 | `GET /elections`, `GET /voterinfo?address=` (polling places, contests, candidates), `GET /divisions` | JSON | Google Cloud API key | Default 25,000 queries/day per project (S) | Google API ToS; data via Voting Information Project | V on methods; quota S |
| OpenStates v3 (Plural) | v3.openstates.org (docs.openstates.org/api-v3) | `/people`, `/people.geo`, `/bills`, `/jurisdictions`, `/committees`, `/events` | JSON; bulk dumps (U) | Free key from open.pluralpolicy.com, `X-API-KEY` header | Default 10/min and 500/day (S). Higher tiers by email. | CC0 (U) | V endpoints; limits S |
| Ballotpedia API | developer.ballotpedia.org | Bulk data and geographic APIs | JSON, bulk | **Paid.** Contact data sales. | Refreshed every 24h | Proprietary; licensees can't share full datasets | V |
| Ballotpedia web pages | ballotpedia.org | Ballot measures, legislative chamber control | HTML | none | n/a | Conflicting; news-site rules bar scraping | U, treat as no-scrape / link-out |
| Wikipedia / MediaWiki API | en.wikipedia.org/w/api.php (`action=parse&prop=wikitext\|text`, REST `/page/html/`) | 2026 Senate, House, Governor pages. Senate page has ratings table (Cook, Sabato, Inside, DDHQ, Economist, FiftyPlusOne, Fox, NBC, RCP, Silver Bulletin, Split Ticket), election-dates table with poll closing times, race-summary table. | HTML or wikitext | none | No hard read limit. Descriptive User-Agent, `maxlag`, serial requests, cache. | CC BY-SA 4.0, attribution + share-alike | V |
| Wikidata | wikidata.org (SPARQL, `Special:EntityData`) | Politician and office entities | JSON, SPARQL | none | Fair-use | CC0 | S |
| MEDSL on Harvard Dataverse | House 1976-2024 doi:10.7910/DVN/IG0UN2 (published 2026-03-09). County presidential 2000-2024 doi:10.7910/DVN/VOQCHQ (S). Senate doi:10.7910/DVN/PEJ5QU (S). Precinct House 2020/2024 doi:10.7910/DVN/VLGF2M, doi:10.7910/DVN/USBYR4. | 2022 and 2024 baselines | CSV, tab, Stata | none; guestbook may gate (U) | Dataverse API `/api/access/datafile/:persistentId?persistentId=...` | CC0 (S) | V on House/precinct DOIs |
| tonmcg county results | github.com/tonmcg/US_County_Level_Election_Results_08-24 | County presidential 2008-2024 incl. `2024_US_County_Level_Presidential_Results.csv` | CSV | none | GitHub raw | MIT. README: "not authoritative" (2024 scraped from Fox News). | V |
| Downballot (ex-Daily Kos Elections) | the-db.co/presbycd → the-downballot.com/p/the-downballots-calculations-of-presidential | 2024 presidential by congressional district on 2026 lines; covers all new maps adopted before the midterms | Google Sheet id `1eZfaFI-c-PFOoKx1-zZA2MP0_dxRq_LVK0re3BOQqy0`; tabs: table, exact totals, state/county breakdown | none | Export via `/export?format=csv&gid=...` (U) | Not stated | V. Post dated 2025-04-23 — check late map changes (TX, CA, MO, UT) (U). |
| VoteHub API | votehub.com/polls/api, `https://api.votehub.com/polls?poll_type=generic-ballot` | Polls with filters (pollster, subject, dates, sample size, rv/lv/a). `/polls/{id}`, `/subjects`, `/poll-types`. Types: approval, favorability, generic-ballot. Partisan/internal flags. | JSON REST (beta) | Appears none (U) | Not found | CC BY 4.0. Credit VoteHub + each poll's source URL. | S (site 403'd) |
| 538 | github.com/fivethirtyeight/data | Static CSVs incl. `congress-generic-ballot` | CSV | none | none | CC BY 4.0 data, MIT code | V repo up; frozen, no 2026 data |
| RealClearPolling | realclearpolling.com | Polling averages | HTML | none | no API | Unknown; ToS unreachable | U. Assume no scraping. |
| Silver Bulletin | natesilver.net | House/Senate/Gov forecasts, generic ballot | HTML | Substack, some paid | n/a | Proprietary | S. Link out only. |
| Split Ticket | 270towin.com/2026-house-election/split-ticket-2026-house-ratings | House and Senate ratings | HTML | none | n/a | n/a | S |
| Race to the WH | racetothewh.com | House/Senate forecast, 50k-sim model | HTML | none | n/a | n/a | S |
| Cook / Sabato / Inside Elections | cookpolitical.com, centerforpolitics.org/crystalball, insideelections.com | Ratings | HTML | Cook race pages subscriber-only; topline public | n/a | Proprietary | S |
| 270toWin | 270towin.com/2026-senate-election/ | Consensus map and per-forecaster tables ("As of Oct. 23, 2026") | HTML, embeddable map | none | n/a | © Electoral Ventures LLC | V |
| Wikipedia ratings table | en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_election_ratings | Cook, Sabato, Inside latest ratings with dates | wikitext table | none | see MediaWiki | CC BY-SA | S |
| UF Election Lab | election.lab.ufl.edu/early-vote/2026-early-voting/ | National/state early+mail totals, demographics, mail return rates. Updated 2026-10-30. | HTML/map only. **No CSV or API.** | none | n/a | **CC BY-NC-ND 4.0** | V — link-out only |
| TargetEarly | targetsmart.com | Early-vote tool (past cycles) | Web | unknown | n/a | n/a | U. No 2026 edition found. |
| Aristotle early/absentee dashboard | globenewswire release 2026-06-02 | Free real-time ballot-return tracker (primaries) | Web | none | n/a | n/a | S. General unconfirmed. |
| 270toWin poll closing times | 270towin.com/content/local-poll-closing-times-november-2026-general-election | Chart (image) of closing times in ET | Image | none | n/a | n/a | V |
| Green Papers | thegreenpapers.com/G26/PollingHours.phtml | Local poll hours with UTC | HTML | none | n/a | n/a | S |

## Notes and risks

1. **FEC key.** Store as Vercel env var, cache heavily. A few hundred candidate/totals calls fit inside 1,000/hr. Schedule E is heavy — use `/schedules/schedule_e/by_candidate` rollup or bulk files, sync on cron.
2. **Google Civic.** Representatives API turned down April 2025. Docs (updated 2025-04-30) list only elections, voterinfo, divisions. Elections expire after Election Day. One address at a time — no use for a master candidate list. Use FEC + Wikipedia for candidates; optional `voterinfo` for polling-place lookup.
3. **UF Election Lab.** CC BY-NC-ND and no download → link-out only.
4. **VoteHub.** Only free, open-licensed (CC BY 4.0) polling API found. Confirm no-auth and rate limit before depending on it. Fetch/cache server-side.
5. **538 is dead.** ABC shut it March 2025; May 2026 archives wiped. GitHub repo is frozen history.
6. **Wikipedia licensing.** CC BY-SA workable with attribution + link; derived tables carry share-alike. Ratings table is the cheapest free Cook/Sabato/Inside route. Parse at build time or on cron.
7. **Ballotpedia.** Paid-or-link-out. For ballot measures and chamber control use Wikipedia's 2026 ballot measure / state legislative election articles, or link to Ballotpedia.
8. **MEDSL.** House DOI verified. Download via Dataverse API, commit trimmed CSVs to the repo (guestbook gating can break automated fetches).

## Election calendar (Nov 3, 2026)

- **Scope.** 35 Senate seats: 33 regular + 2 special (V). Specials: **Ohio** (Husted R-appointed vs Sherrod Brown D) and **Florida** (Moody R-appointed vs Angie Nixon D).
- **Georgia.** Majority required; runoff **Dec 1, 2026** (S). Senate: Ossoff (D) vs Mike Collins (R).
- **Louisiana.** Now closed party primaries (S). Senate primary May 16, runoff June 27; Cassidy finished third, Letlow and Fleming advanced (runoff winner unconfirmed). Nov 3 Senate general is plurality (S). House reverting to all-party open primary on Nov 3 is **U** — check LA SoS.
- **Poll closing times (U, from memory).** Window 6pm ET Tue to 1am ET Wed. Usual pattern (ET): 6pm IN, eastern KY · 7pm GA, SC, VA, VT, most FL, rest of KY/IN · 7:30pm NC, OH, WV · 8pm most Northeast/Midwest + AL, MS, MO, OK, TN, TX · 8:30pm AR · 9pm AZ, CO, LA, MN, NM, NY, WI, WY · 10pm ID, MT, NV, UT, IA, OR · 11pm CA, WA, HI · up to 1am AK. **Pull the official table from 270toWin or Green Papers before shipping.**

## Not verified
Google Civic `voterinfo` 2026 coverage; OpenFEC 7,200/hr tier; VoteHub rate limits/auth; MEDSL guestbook and Senate/county DOI license text; Downballot sheet coverage of late redistricting; Sabato/Inside paywall status; RCP ToS; Ballotpedia main-site ToS.
