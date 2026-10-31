# Live-feed fixtures

Raw samples of the state result feeds used by `src/data/adapters/*`, pulled with `curl` on
**2026-10-30** (four days before the 2026-11-03 general). 2026 files are the staged zero-vote
publications (real candidate lists, schema as it will be on election night); 2024/2025 files are
certified results from the same endpoints where they are still served, for realistic totals.

Files marked **truncated** were cut down to stay under ~3 MB; each carries a `_note` field
(JSON) or a leading `#` comment line (MN text) describing exactly what was kept. Nothing inside a
kept record was altered, except that Enhanced Voting `precinctResults` arrays were nulled.

| Dir | File | Source | Notes |
|---|---|---|---|
| nc | `results_0.2026.txt` | `https://er.ncsbe.gov/enr/20261103/data/results_0.txt` | statewide, 660 rows, 0 votes |
| nc | `results_1.2026.txt`, `results_92.2026.txt` | `…/20261103/data/results_{cid}.txt` | Alamance (cid 1), Wake (cid 92) |
| nc | `results_0.2024.txt`, `results_1.2024.txt`, `results_92.2024.txt` | `…/20241105/data/…` | certified 2024, vote-method split populated |
| va | `jurisdictions.json` | `https://enr.elections.virginia.gov/results/public/api/jurisdictions/virginia` | slug discovery (32 elections) |
| va | `election.2026.json`, `ballot-items.2026.json` | `…/results/public/api/elections/virginia/2026-November-General[/ballot-items]` | |
| va | `export-2026-November-General.truncated.json` | `…/cdn/results/virginia/export-2026-November-General.json` (26 MB) | **truncated**: US Sen, US House 1–11, 3 amendments; 6 localities |
| va | `export-2025-November-General.truncated.json` | `…/cdn/results/virginia/export-2025-November-General.json` (24 MB) | **truncated**: Gov/LG/AG, 6 localities; certified, real votes + modes |
| ga | `jurisdictions.json` | `https://results.sos.ga.gov/results/public/api/jurisdictions/Georgia` | 117 elections; **no 2026-11-03 entry yet** |
| ga | `election.2024NovGen.json` | `…/results/public/api/elections/Georgia/2024NovGen` | |
| ga | `export-2024NovGen.truncated.json` | `…/cdn/results/Georgia/export-2024NovGen.json` (34 MB) | **truncated**: President + US House 1–14; Fulton, DeKalb, Cobb, Gwinnett, Chatham, Candler |
| ca | `governor.json`, `ballot-measures.json`, `status.json` | `https://api.sos.ca.gov/returns/{governor,ballot-measures,status}` | SoS test numbers (2.5 % precincts) |
| ca | `us-rep-district-{1,13,52}.json` | `…/returns/us-rep/district/{n}` | list route `/returns/us-rep` → 500 |
| ca | `governor-county-{alameda,san-francisco,los-angeles}.json`, `ballot-measures-county-alameda.json` | `…/returns/governor/county/{slug}` | array `[county, statewide]` |
| mn | `allracesbyprecinct.2026.truncated.txt` | `https://electionresultsfiles.sos.mn.gov/20261103/allracesbyprecinct.txt` (27 MB) | **truncated**: offices 0102/0104–0111/0331; counties 01–20, 27, 62 |
| mn | `allracesbyprecinct.2024.truncated.txt` | `…/20241105/allracesbyprecinct.txt` | **truncated** same way (+ 0101 President); certified |
| mn | `cntytbl.txt`, `ussenate.{2024,2026}.txt`, `ushouse.{2024,2026}.txt`, `Governor.2026.txt` | `…/{date}/…` | small statewide files |
| ak | `GA_ENR_Precinct_State_of_Alaska.2026.truncated.csv` | `https://www.elections.alaska.gov/enr26/results/GA_ENR_Precinct_State_of_Alaska.csv` (4.7 MB) | **truncated**: US Sen/Rep, Gov, HD 1–2, SD A, BM 1; Pct_Id prefixes 01–20 + 99. DoE test numbers, Reporting_flag 0 |
| ia | `elections.json`, `current_ver.{2024,2026}.txt` | `https://results.enr.clarityelections.com/IA/[elections.json \| {eid}/current_ver.txt]` | EID 127077 (2026) / 122322 (2024) |
| ia | `summary.{2024,2026}.json`, `details.{2024,2026}.json`, `status.2026.json` | `…/IA/{eid}/{ver}/json/[en/summary.json \| details.json \| status.json]` | |
| ia | `detailxml.2026.zip` | `…/IA/127077/382865/reports/detailxml.zip` | exercises the zip + XML fallback |

No NYT fixture is kept (ToS forbids cached datasets); `tests/adapters/nyt-xcheck.test.ts` uses a
synthetic document with the observed shape.
