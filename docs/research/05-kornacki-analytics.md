# Election-night analytics recipe (gap-fill research, 2026-10-30)

Several primary pages could not be fetched: NYT needle explainer, 538 benchmarks page, Bloomberg, Economist, Guardian, Split Ticket, Rohla, Edison/NEP methodology. Anything unsourced is marked **[UNVERIFIED]**. Items marked **[ANALYST]** are standard practice stated from general knowledge, not from a fetched source.

## 1. Computational recipe

### Inputs (all free)
- **2024 and 2020 presidential county results.** MIT Election Data and Science Lab (MEDSL) county returns 2000-2024 on Harvard Dataverse, DOI 10.7910/DVN/VOQCHQ, reportedly CC0. Warning: filtering on `mode='TOTAL'` silently drops ~1,000 counties in 2020+ data — sum the modes yourself.
- **Live results** from state SOS feeds, Clarity/Scytl sites, or county feeds.
- **Turnout baseline** (2022 and 2024 total votes per county) to size the expected vote.

### Expected vote (AP's approach, verified at the level of inputs)
AP publishes no formula or weights. Inputs: prior-election turnout, population change, voter registration, competitiveness, pre-Election-Day (early/mail) turnout, Election Day turnout from officials, actual returns as they arrive. AP re-estimates continuously; "% of expected vote" can fall if turnout is revised up (AP example: 1.0M → 1.2M). AP never shows 100% until certification. "Precincts reporting" is unreliable because precincts differ in size and some report partially.

**Implementable proxy [ANALYST]:**
```
EV_county = max( votes_in_so_far, baseline_turnout * turnout_adj, early_vote_returned + election_day_est )
turnout_adj = (statewide early-vote counts so far / same point in 2022 or 2024)   # optional
pct_expected = votes_in / EV_county
remaining    = max(EV_county - votes_in, 0)
```
Cap `pct_expected` at 99% until the state flags a county "complete". Re-baseline `EV` upward whenever `votes_in > 0.97 * EV`.

**Only "precincts reporting" available [ANALYST]:** `remaining ≈ votes_in * (1 - p) / p`, p = fraction of precincts reporting. Weight by precinct size using prior-election precinct turnout where available. Treat p as an upper bound; clamp p ≤ 0.95 until the county says it is done.

### County benchmark and "needs X% of remaining vote"
Benchmark definition verified from 538's 2024 benchmarks page (snippets only): the share each party needs in a county for the statewide race to be roughly tied, combining the party's estimated county share with the county's share of the statewide vote. Morris's spreadsheet measures how far ahead/behind a candidate runs versus a tied contest, listing 2024 and 2020 county results.

```
# uniform swing (state-level pre-election poll/forecast margin M_state vs 2024 state margin M24_state)
swing = M_state_expected - M24_state
bench_margin[c] = M24[c] + swing                  # expected margin in county c
# "tied-race" benchmark (538 style)
tie_margin[c]   = M24[c] - M24_state              # county lean relative to state
over[c] = margin_now[c] - bench_margin[c]         # + means beating benchmark
# what's left
need_share_of_remaining[c] = (target_margin[c]*EV[c] - margin_votes_now[c]) / remaining[c]
need_statewide = (-(D_now - R_now)) / remaining_total
```
Flag a county "impossible" when `need_share` > 100% or < -100%.

### Projection (needle-style, simplified)
NYT Needle partly verified (2022 Yahoo report quoting the Times): compares results with pre-election expectations per county/precinct, estimates how remaining votes break from patterns counted so far, journalists review all data. 2018: pulled when a GOP-heavy county would not post precinct results. Similar-county propagation **[UNVERIFIED]** here.

```
for each county c: residual[c] = margin_now[c] - bench_margin[c]       # only if pct_expected[c] >= ~20-30% AND mode-adjusted
group counties by cluster (urban/suburban/rural x region x demographics)
cluster_resid[g] = weighted mean(residual[c] by votes_in)
proj_margin[c] = bench_margin[c] + blend(residual[c], cluster_resid[g(c)], weight=pct_expected[c])
final_margin_state = sum(proj_margin[c]*EV[c]) / sum(EV)
uncertainty = shrinks as sum(votes_in)/sum(EV) rises; simulate with correlated county errors
```
DDHQ's live model (HDSR 2024, "Election Night Forecasting With DDHQ") is the one published academic-style reference: thousands of simulations on a continuous feed, isolates data from high-completion units, cautious in high-mail states. PDF 403'd. Washington Post / Candès conformal-inference model: 2024 seminar abstract only **[UNVERIFIED]**.

### Vote-order handling (red mirage / blue shift)
Store per-county `mode_order` and apply a mode-share correction. MEDSL 2020+ breaks results out by mode.

| State | Early reporting | Effect |
|---|---|---|
| NC | Mail first | blue mirage |
| GA | Early and mail first; Election Day follows | blue mirage |
| AZ | Early in-person and mail by 8pm ET; late-arriving later | early blue, later shift |
| PA | Mail-heavy early (Philly, Allegheny), big-city mail can come late | [mixed] |
| WI | Mail cannot be processed before Election Day; Milwaukee late | late Democratic |
| MI | 2024 order not confirmed | [UNVERIFIED] |
| FL | Commonly early/mail first, unconfirmed | [UNVERIFIED] |

(From NPR and Axios 2024 explainers via snippet — verify before use.)

## 2. Visual spec (Kornacki-style)
Verified facts: large touchscreen; maps and data compared against previous elections (NBCU Academy); tracks city, township, county, CD and state level (2018 coverage); "what if" mode for ~60 key races with 4-second latency from the Decision Desk (2018); a separate map per battleground state with a theme (demographics, voting history); studies how and how fast counties report, runs scenarios on victory thresholds, keeps handwritten reference cards.

Recommended components [ANALYST]:
1. **County map with swing coloring** — fill = margin vs 2024 (diverging, centered on 0); opacity = `pct_expected`.
2. **"What's left" bars per county** — counted vs estimated remaining, annotated with `need_share_of_remaining`.
3. **Key-county watchlist** — pct expected, current margin, benchmark margin, over/under, needs X% of remainder.
4. **Path-to-majority tracker** — Senate seats needed (50/51 w/ VP) from calls plus leaning ratings.
5. **House "seats needed" tally** (218) by rating tiers.
6. **Mirage badge** per state showing which vote mode has reported.

## 3. Reference data
- **County presidential 2000-2024:** MEDSL https://electionlab.mit.edu/data. Also American University dataset (1912-2024) https://aura.american.edu/articles/dataset/U_S_Presidential_Election_Data_1912-2024/30201322 (not opened). tonmcg repos stop at 2016.
- **2024 presidential by 2026 congressional district:** no Daily Kos/Sabato/Split Ticket spreadsheet found. Daily Kos 2020-on-2022-lines at http://dkel.ec/map. New 2026 maps enacted in TX, CA (Prop 50), MO and others. Fallback: build from precinct/county data on new boundaries.
- **Senate county results:** use MEDSL presidential layer; no combined Senate county source found.
- **Bellwether counties 2026 Senate:** nothing by state. Newsweek "100 counties" https://www.newsweek.com/100-counties-decide-2026-midterms-12233535 (snippet; names Scott and Dallas IA). 2024 lists: Cook's 13 (via Axios), Semafor 20-county tracker, Atlanta suburbs. **Build your own** by ranking counties on how closely 2024 tie-margin tracks statewide.

## 4. Open-source projects
- **alex/nyt-2020-election-scraper** (MIT; git-scraping NYT "votes remaining" JSON into results.json with HTML/CSV/XML diffs). Good change-detection/diff structure. 2020 endpoints may have changed.
- **MinnPost/election-night-api** (Python, SQLite, per-state scraper folders). Clean per-state scraper pattern; license unconfirmed.
- **elex-clarity** (PyPI CLI for Clarity/Scytl), **OpenElections clarify**.
- **rdmurphy/scrape-la-county-election-results-2024** (GitHub Action snapshot scraper), **argusdusty/VoteTracker** (Go server, results maps, JSON API).
- No open-source repo combining a Kornacki-style map with balance of power for 2022/2024 found.

## 5. Not found / gaps
NYT needle methodology (blocked), Bloomberg, Economist, Guardian, Edison/NEP, Morris 2024 write-up, Split Ticket explainers, Rohla — all **[UNVERIFIED]**. AP explainer original: https://apnews.com/article/expected-vote-turnout-precincts-reporting-elections-dbf56f63d08d57c839d91bdb9a98ed19 (read via repost).

## Sources
- AP expected vote repost: https://www.wbtv.com/2026/03/02/how-ap-uses-expected-vote-instead-precincts-reporting-when-determining-winner
- 538 benchmarks (snippet): https://projects.fivethirtyeight.com/2024-election-benchmarks
- NYT needle (2022 via Yahoo): https://news.yahoo.com/york-times-election-needle-briefly-025046450.html
- Morris benchmark spreadsheet: https://www.gelliottmorris.com/p/how-to-watch-tonights-statewide-election
- DDHQ HDSR: https://hdsr.mitpress.mit.edu/pub/zr6hjsfl ; https://analysis.decisiondeskhq.com/category/methodology
- Kornacki prep: https://nbcuacademy.com/steve-kornacki-2024-election/ ; https://www.newscaststudio.com/2018/11/05/nbc-big-board-update/
- Mirage by state: https://www.npr.org/2024/10/06/nx-s1-5141959/electoral-college-map-what-is-blue-shift-red-mirage ; https://www.axios.com/2024/11/05/trump-harris-2024-election-absentee-voting-red-mirage
- Counties to watch: https://www.axios.com/2024/11/05/election-night-results-counties-to-watch-votes ; https://www.semafor.com/article/11/04/2024/semafor-bellwethers-our-hour-by-hour-guide-on-how-to-watch-the-2024-election-like-an-expert
- MEDSL: https://electionlab.mit.edu/data
- Repos: https://github.com/alex/nyt-2020-election-scraper ; https://github.com/MinnPost/election-night-api ; https://pypi.org/project/elex-clarity ; https://github.com/OpenElections
