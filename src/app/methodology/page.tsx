import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Methodology: How the Big Board Projects Elections",
  description: "How the Big Board turns polls, ratings, vote counts and election history into projections for the 2026 midterms, what it adjusts, and what it does not.",
  path: "/methodology",
});

export default function MethodologyPage() {
  return (
    <article className="prose prose-invert max-w-3xl prose-headings:display prose-headings:tracking-tight">
      <h1>How the Big Board works</h1>
      <p className="lead">
        Every number on this site traces back to an official state or county election office, a public-domain federal
        dataset, or an openly licensed aggregate. We hold no AP or Decision Desk license, so we do not republish anyone
        else&apos;s race calls. What you see labelled <strong>Projected</strong> is our own model&apos;s output, with the rule
        spelled out below.
      </p>

      <h2>1. Vote counts</h2>
      <p>
        An ingest job runs every minute and pulls machine-readable results straight from election authorities. Each state
        is tagged with a <em>tier</em> you will see next to its name:
      </p>
      <ul>
        <li>
          <strong>Tier A: official statewide feed.</strong> A single JSON/CSV published by the state (North Carolina,
          Virginia, Georgia, California, Minnesota, Alaska, Iowa).
        </li>
        <li>
          <strong>Tier B: county feeds.</strong> States whose own site blocks automated access but whose counties publish
          open files (Arizona, Pennsylvania, Texas, Ohio, Michigan, New York, Florida). Coverage is partial and labelled.
        </li>
        <li>
          <strong>Tier C: delayed or community-edited.</strong> Hand-edited tables (Wikipedia, CC BY-SA) used only where nothing
          machine-readable exists. Expect lags of minutes to hours.
        </li>
      </ul>

      <h2>2. Expected vote</h2>
      <p>
        &ldquo;Precincts reporting&rdquo; is a poor progress bar: precincts differ in size and often report partial
        results. Like the AP, we estimate an <em>expected vote</em> per county and show the share of it that has been
        counted. Our proxy is the larger of (a) votes counted so far, (b) the county&apos;s 2024 presidential turnout
        scaled by this cycle&apos;s statewide early-vote pace, and (c) early ballots returned plus an Election-Day estimate.
        When a feed gives only precinct counts we use <code>votes × (1 − p) / p</code> with <code>p</code> capped at
        0.95. We never display 100% until the county flags itself complete, and we revise the estimate upward if counting
        passes 97% of it.
      </p>

      <h2>3. Benchmarks and &ldquo;needs X% of what&apos;s left&rdquo;</h2>
      <p>
        Each county gets a <em>benchmark margin</em>: its 2024 presidential margin shifted by the uniform swing implied by
        the pre-election consensus for the race. A county running ahead of benchmark is good news for that candidate even
        if they trail in raw votes there. For the statewide picture we compute the share of the remaining expected vote the
        trailing candidate needs to pull even; anything over 100% is marked <em>impossible</em>.
      </p>

      <h2>Then &amp; Now: polls against history</h2>
      <p>
        The <a href="/history">Then &amp; Now</a> page sets current polling against past elections. History is the
        presidential result by state since 1976 (MIT Election Data + Science Lab), plus Senate and governor margins since
        1990 and House margins for 2022 and 2024 (Wikipedia). A place&apos;s <em>projected margin</em> is its race poll
        average where one exists. Where none does, it is the 2024 presidential margin moved by the national swing since
        2024 (the generic ballot against the 2024 popular vote), applied on a logit scale so lopsided places stay bounded.
        <em> Last this way</em> is the most recent election whose margin was at least as far toward the projected side;
        &ldquo;none&rdquo; means no election in the data was.
      </p>
      <p>
        Polls are shown as published. We have not adjusted for past poll error: no published figure for this year&apos;s
        miss exists yet, and the direction has flipped from cycle to cycle. A Senate or governor poll is compared against
        presidential history, so candidate strength shows up as extra &ldquo;change&rdquo;. House history is only
        comparable within a map era, so districts redrawn for 2024 or 2026 carry a caveat.
      </p>

      <h2>4. The projection band</h2>
      <p>
        Counties that have reported at least 20% of their expected vote contribute a residual (actual − benchmark). We
        pool residuals within clusters (urban / suburban / rural by region), blend each county&apos;s own residual with
        its cluster&apos;s in proportion to how much it has reported, and sum the projected margins weighted by expected
        vote. The uncertainty band is a heuristic that shrinks as the count comes in; it is not a probabilistic forecast.
      </p>

      <h2>5. When we say &ldquo;Projected&rdquo;</h2>
      <p>A race is marked projected when either condition holds and has held for two consecutive updates:</p>
      <ul>
        <li>the leader&apos;s vote margin exceeds the total votes we expect remain to be counted, or</li>
        <li>
          at least half the expected vote is in and the leader&apos;s margin in points exceeds the larger of 2 points and
          the model band.
        </li>
      </ul>
      <p>
        Georgia&apos;s majority requirement is handled explicitly: if no one can reach 50% + 1 we mark the race
        <em> runoff</em> (Dec 1, 2026).
      </p>

      <h2>6. Vote-order warnings (&ldquo;mirage&rdquo; badges)</h2>
      <p>
        States count ballots in different orders. North Carolina and Georgia post early and mail ballots first, so the
        first numbers skew Democratic; Wisconsin&apos;s big cities report absentee ballots late, so early numbers skew
        Republican. Where a feed breaks votes out by method we show which modes have reported; elsewhere we badge the
        state from its published counting procedure.
      </p>

      <h2>7. Balance of power</h2>
      <p>
        Called seats come from our projection rule. Uncalled seats are shown as <em>leaning</em> by the median of the Cook
        Political Report, Inside Elections and Sabato&apos;s Crystal Ball ratings (via Wikipedia&apos;s CC BY-SA tables),
        with toss-ups in the middle. Senate seats not up this year are included so the bar shows the chamber, not just
        the ballot.
      </p>

      <h2>8. What we deliberately don&apos;t do</h2>
      <ul>
        <li>Scrape or redisplay the New York Times, CNN, Politico or other media results feeds.</li>
        <li>Republish AP, network, or Decision Desk race calls.</li>
        <li>Present the model band as a probability of winning.</li>
      </ul>
    </article>
  );
}
