# Free election-night data sources for Nov 3 2026 (gap-fill research, checked 2026-10-30)

"V" = fetched from this machine. "T" = from the public TeamStewart/cbs-enr `docs/enr_cycle/tracker.csv` (CBS/MIT MEDSL tracker, no license — reference only). "U" = unverified.

## Corrections to the tier-1 premises
- **GA is no longer Clarity.** `results.sos.ga.gov` is Enhanced Voting (EV) since ~Nov 2024.
- **EV has an open JSON API and full-state export, no key (V).** API: `https://{host}/results/public/api/elections/{jurisdictionSlug}/{electionSlug}`; sub-routes `/ballot-items`, `/stats`, `/localities`, `/turnout`, `/vr`. Full export: `https://{host}/cdn/results/{slug}/export-{electionSlug}.json`. County EV exports: `app.enhancedvoting.com/cdn/results/{county}-county-{st}/export-{slug}.json` (T). AZ, MI, NY, OH, TX, CA counties use this.
- **Several state sites block bots from curl:** PA (Imperva), AZ (Cloudflare challenge), TX (Cloudflare), NV (403), OH (403), WI (403), AK html pages (403), NY results site (403), NH (403), MN landing (Radware), Clarity detail paths (403 on GA). A real browser gets through PA.
- **Clarity statewide is only IA, CO and stale KS.** `results.enr.clarityelections.com/{ST}/elections.json` (V; use `--compressed`). IA "2026 General Election" EID 127077, `/IA/127077/current_ver.txt` → 382865. CO lists only 2026 Primary (126592). KS one 2015 entry. VA, NJ, OH, TX, NV return HTML shell. Many counties on Clarity (AZ Pinal 127280, PA Allegheny 127287, MI Emmet 127403).

## Per-state table

| State | System | Endpoint pattern | Format | Auth / bots | Conf. |
|---|---|---|---|---|---|
| NC | Own (S3/Cloudflare) | Live: `https://er.ncsbe.gov/enr/20261103/data/results_0.txt` — statewide, 660 contests, staged at 0 votes. Fields: `cnm`, `bnm`, `pty`, `vct`, `pct`, `prt`/`ptl` (precincts reporting/total), `evc`/`ovc`/`avc`/`pvc` (vote-method split). Post-election: `https://dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip` | JSON as .txt | None; no bot block | V, high |
| VA | EV | `https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General` + `/ballot-items`. Export: `.../cdn/results/virginia/export-2026-November-General.json` (26 MB, live) | JSON | None | V, high |
| GA | EV | API `https://results.sos.ga.gov/results/public/api/elections/Georgia/{slug}`; export `/cdn/results/Georgia/export-{slug}.json`. 2024 slug `2024NovGen` works. Tracker names 2026 slug `11032026GeneralAndSpecialElection` — 404 today | JSON | None | Pattern V; 2026 slug unresolved |
| CA | Own API | `https://api.sos.ca.gov/returns/governor`, `/ballot-measures`, `/status` (county `precinctsReporting`/`precinctsTotal`/`voterTurnout`). `/returns/us-rep` gave 500 | JSON | None, curl OK | V, high |
| MN | Own flat files | `https://electionresultsfiles.sos.mn.gov/20261103/allracesbyprecinct.txt` (staged at 0). Folder index 403 | Semicolon-delimited | Landing behind Radware; files reachable | V file |
| AK | Own CSV | `https://www.elections.alaska.gov/enr26/results/GA_ENR_Precinct_State_of_Alaska.csv`. Per-precinct `Reporting_flag`, vote-method split | CSV | Files OK; html 403 | V |
| IA | Clarity statewide | `/IA/127077/current_ver.txt` → version; then standard Clarity summary/detail. Public `electionresults.iowa.gov/IA/` | Clarity JSON/XML zip | None for list/version; detail untested | V list, U detail |
| CO | Clarity | `/CO/elections.json`; general not created yet | Clarity | None | V |
| AZ | Counties only (state site Cloudflare-gated) | Maricopa: `.txt` linked from `elections.maricopa.gov/results-and-data/election-results.html` (posts 8pm ED, updates daily). Cochise/Mohave/Navajo: EV `export-General11032026.json`. Pinal: Clarity 127280. Pima: livevoterturnout.com `pimaazenr/7` | TXT, JSON, HTML | Mostly open | T + V (Maricopa page), medium |
| PA | `electionreturns.pa.gov` (Angular, Imperva). Reporting Center, Election Feed, By-County / By-Vote-Method. `/api/...` returns .NET Web API JSON 404s → JSON API exists | Paths not found | JSON | Blocks curl; browser passes | Endpoints unverified |
| PA counties | Allegheny Clarity 127287; Montgomery CSV `gis.montcopa.org/opendata/GE2026/data/...csv`; Philadelphia `philadelphiaresults.azurewebsites.us`; Dauphin `elections.dauphincounty.gov/?key=42` | Varies | Open | T |
| NY | State 403; NYC `enr.boenyc.gov` → `vote.nyc` | 21 counties on EV exports (e.g. Broome `export-GE2026_...json`) | JSON | EV open | T |
| FL | State `floridaelectionwatch.gov` (server-rendered HTML, `/TrackCounty/{ABC}`, scrapeable). County `enr.electionsfl.org/{CTY}/{id}/Reports/` (39 live) | HTML | Open | V + T; no JSON |
| MI | No state feed found (`mielections.us` timed out). 20 counties EV, 6 Clarity, Wayne `michigan.totalvote.com/Wayne`. 28 counties PDF-only | Mixed | Mixed | T |
| OH | Counties only. Cuyahoga EV `export-GE2026.json`. Franklin `vote.franklincountyohio.gov/elections/api/election/live`. liveresults.boe.ohio.gov. 67/82 not posted yet | Mixed | Open | T; state U |
| TX | State `results.texas-election.com` Cloudflare-gated. Harris `appfiles.harrisvotes.com/harrisvotes/prd/Data/1126`; 18 Clarity counties | Mixed | Mixed | T |
| WI | No state ENR. Dane, Rock, Wood, Barron HTML; Milwaukee not posted as of 10-30 | HTML | Open | T |
| NJ | Counties only: 4 Clarity, 2 livevoterturnout (Bergen) | Mixed | Open | T |
| KS | Harvey Clarity; Anderson livevoterturnout | Mixed | Open | T; state U |
| NV, ME, NH | Not in tracker; NV `silverstateelection.nv.gov` 403, NH 403. Browser-only or manual | — | — | Unverified |

## Media JSON endpoints and terms of service
- **NYT is live and CORS-open (V).** `https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-senate.json` (650 KB, 35 races), `.../results-house.json` (6.8 MB). Headers `Cache-Control: max-age=5`, `Access-Control-Allow-Origin: *`. Per race: `race_call_status`, `outcome.won`/`called_by`, `top_reporting_unit` with `eevp` (estimated expected vote %), `total_expected_vote`, `precincts_reporting`/`precincts_total`, `provider: "ap"`, `reporting_units` (counties). Already published at zero votes → stable schema.
  - **Terms (V, robots.txt):** prohibits automated data mining/scraping without written permission, prohibits providing archived/cached datasets to others, and commercial purposes.
  - **Risk:** tolerated hobbyist feed only. CORS does not grant a license; data is AP-sourced so redistribution is the sharpest risk. **Do not build the product on it.** At most a private cross-check at low polling rate.
- **CNN:** guessed `politics-elex-results.data.api.cnn.io/...` returned 500; paths unverified. robots.txt blocks AI bots.
- **Politico:** 403 to curl; no endpoint found. **Google results panel:** no public API (U).
- **Wikipedia:** API works from curl; CC BY-SA; hand-edited, lags minutes to hours (U).

## Race-call sources
- Free, realistic latency (U): AP calls as shown on NYT (`called_by`) within a minute or two; Wikipedia delayed; DDHQ public site (ToS unchecked); concessions on X; state certification days-weeks.
- **Recommendation:** compute own "called" status from state feeds with an explicit margin-and-expected-vote rule, labeled a projection. Do not republish AP calls.

## Expected vote and ballots remaining
- **NYT** `eevp` / `total_expected_vote` is the only complete percent-of-expected-vote source (ToS issue).
- **State feeds with precinct counts (V):** NC `prt`/`ptl` + vote-method split; CA `/returns/status` per county; AK per-precinct flag + method split; EV `precinctsReporting` and `totalVoters` (null/0 until live); Clarity precincts reporting + registration + turnout.
- **Maricopa (V):** no ballots-remaining report on the page; outstanding counts via press releases/social (U). **PA mail counts:** By-Vote-Method tab exists, endpoints unfetched (U).

## Open-source repos
| Repo | License | Activity | Use |
|---|---|---|---|
| openelections/clarify | MIT | pushed 2025-11 | Clarity discovery and parse |
| washingtonpost/elex-clarity | MIT | 2022 | Clarity CLI |
| alex/nyt-2020-election-scraper | MIT | 1,757 stars | NYT git-scraping pattern |
| nealmcb/snapshot-election-results | MIT | 2023 | Clarity snapshotter |
| MinnPost/election-night-api | NOASSERTION | 2015 | One scraper class per state; dated |
| votingworks/election-night-reporting | GPL-3.0 | 2021 | Demo ENR app; copyleft |
| TeamStewart/cbs-enr | none (all rights reserved) | active 2026-10-30 | tracker.csv + `scripts/archived/scrapers.R`, `clarity_scraper.py`. Reference only. |
| brennertobe07/va-enr, erxclau/nycboeenr | none | 2026 | Reference only |
| battaglir/JPR-Election-night-scraping | GPL-3.0 | 2026-10-29 | GitHub Actions scraper for OR/CA |

No OpenElections live effort or dedicated "Election Night Results" community repo found.

Raw tracker copy: `C:\Users\micha\AppData\Local\Temp\claude\C---dev-repos-election-2026\1a198646-328c-4307-a538-e6f5eebf9ac2\scratchpad\tracker.csv`
