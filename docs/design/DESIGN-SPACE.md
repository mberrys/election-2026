# Design space: three decisions explored before committing

pstack principle: when an interaction has no established precedent, build 2-3 genuinely different shapes, compare them side by side against explicit criteria, then commit. A second flavour of the first shape does not count.

Method: a temporary route (`src/app/lab-tmp`, deleted before merge) rendered every alternative from the same live simulator snapshot (`SIMULATE=1`, `SIM_SCENARIO=contested`, frozen at 10:45 PM ET Nov 3, so the Georgia count is paused and Alaska and California carry legal flags). Each section was captured at 1440 and 390 px and compared on the criteria below. The three decisions were chosen because each is read first, on the home page, at election-night speed, and each was built once with no alternatives.

## Criteria (scored 1-5 per screenshot)

1. **Glance**: can you say who is ahead, or what is wrong, in two seconds?
2. **Density**: how much of the night fits on one screen at 1440?
3. **Honesty about uncertainty**: is the unsettled part drawn, or folded into a headline number?
4. **Phone (390 px)**: does it still answer its question without a second layout?

## A. Balance-of-power hero (home page, Senate and House)

| | Shape | Glance | Density | Honesty | Phone |
|---|---|---|---|---|---|
| A1 (was) | Two big numbers either side of one shared bar | 4 | 3 | 2 | 4 |
| A2 | Seat grid: one tile per seat, outlined tile marks the majority | 4 Senate, 3 House | 4 | 3 | 3 |
| A3 | Two lanes to the same control line: solid secured, pale leaning, gap = need | 3 | 4 | 5 | 5 |

Findings from the renders:

- A1 folded "+14 leaning" into a grey suffix next to a 48 px number that only counts secured seats, and its centre label collided with the majority tick ("toss-ups" printed over "51"). It never said what either side still lacks.
- A2 is the most beautiful at 100 seats and the outlined majority tile is a good idea. At 435 seats it needs 15 rows and about 340 px of height, and the won, leaning and not-up tones (100%, 55%, 22% alpha) were hard to tell apart at tile size. It also asks the reader to count.
- A3 draws three states per party (secured, leaning, missing) and prints the missing number: "need 17 of 34 open". It is the only variant where the arithmetic that election night is about is on the card. Its weakness is that two near-equal lanes look alike, so the verdict is "who is closer" rather than "who is ahead".

**Verdict: A3.** Honesty and "what does each side need" beat raw glanceability for a product whose editorial line is not to overstate calls. The seat grid is kept as a candidate for a future Senate-only detail view. Implemented as `src/components/board/control-lanes.tsx`; the Senate page's richer `ChamberBalance` is unchanged.

## B. Integrity Watch panel

| | Shape | Glance | Density | Honesty | Phone |
|---|---|---|---|---|---|
| B1 (was) | A bordered card per state, every race and badge always expanded | 2 | 2 | 4 | 3 |
| B2 | Ledger table, one row per state | 4 | 5 | 3 (lost live race progress) | 4 |
| B3 | Exceptions first: flagged states expanded, quiet states as name chips | 5 | 4 | 3 (lost race status, long legal summaries) | 4 |

Findings:

- B1 gave six equal-weight boxes, so the one paused count looked like the five quiet ones until you read badges. Every card also repeated an identical red "No live feed yet".
- B2 scans well but dropped the thing that makes a flag meaningful: how far along the statewide race is.
- B3 answers "what needs attention" instantly but hides the quiet states' race status, which is itself information (Michigan counting at 36%).

**Verdict: B2 plus B3's ordering.** A ledger (rows, rules, aligned columns) with live race progress kept inline, sorted worst first (stalled count, then legal flag, then watch list), and severity shown by a 2 px left edge instead of a coloured box. Implemented in `src/components/board/integrity-watch.tsx`. Emoji glyphs were replaced with words.

## C. Race card (Key races, House hover, state House strip)

| | Shape | Glance | Density | Honesty | Phone |
|---|---|---|---|---|---|
| C1 (was) | Up to three candidate rows with vote bars | 3 | 2 | 2 | 4 |
| C2 | Margin lane: D and R face off across a centre line, bar = current margin, pale span = model range | 4 | 3 | 5 | 4 |
| C3 | One-line ledger row: name, margin, % in, status | 5 | 5 | 2 | 2 (names truncate) |

Findings:

- C1 printed "0 / 0.0%" for every candidate before votes and ranked a candidate's bar by raw percentage, so a 49.6 to 47.9 race and a 70 to 30 race looked alike except in the digits. Third-party candidates took as much space as the contenders.
- C3 is the fastest to scan (six races in about 250 px against 800 px) but loses both candidate names and any uncertainty, and the phone layout truncates race names.
- C2 turns the margin into a position, so close races look close, and the model's band (wide at 10% in, narrow at 89% in) shows that early margins are not final.

**Verdict: C2.** Implemented in `src/components/board/race-card.tsx` with three fixes the prototype showed it needed: nominee selection honours the incumbent and filters namesakes before votes, an independent who leads is named instead of being hidden, and before votes the lane is empty and says "No votes yet" rather than printing zeros. The compact ledger (C3) remains a good candidate for a dense "all toss-ups" view.

## What was not explored

Mechanical or single-approach decisions (colour tokens, type scale, border treatment, copy) were fixed directly under the taste-skill app-screen rules; see the commit log.
