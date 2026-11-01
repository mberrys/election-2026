import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Methodology: How the Big Board Projects Elections",
  description: "How the Big Board turns polls, ratings, vote counts and election history into 2026 midterm projections, what it adjusts, and what it leaves alone.",
  path: "/methodology",
});

export default function MethodologyPage() {
  return (
    <article className="prose prose-invert max-w-3xl prose-headings:display prose-headings:tracking-tight">
      <h1>How the Big Board works</h1>
      <p className="lead">
        Every number on this site traces back to an official state or county election office, a public-domain federal dataset, or an openly licensed aggregate. We hold no <a href="https://www.ap.org" target="_blank" rel="noopener noreferrer">AP</a> or <a href="https://www.decisiondeskhq.com" target="_blank" rel="noopener noreferrer">Decision Desk</a> license, so we never republish their race calls. What you see labelled <strong>Projected</strong> is our own model&apos;s output. The rule appears below. For plain-language background, read the <Link href="/explainers">explainers</Link>.
      </p>

      <h2>1. Vote counts</h2>
      <p>
        An ingest job runs every minute and pulls machine-readable results from election authorities. Each state carries a <em>tier</em> label that you will see beside its name. Counts appear as they arrive on the <Link href="/election-night">election night</Link> page, and the <Link href="/sources">sources page</Link> lists every feed:
      </p>
      <ul>
        <li>
          <strong>Tier A: official statewide feed.</strong> The state publishes one JSON or CSV file. This covers North Carolina, Virginia, Georgia, California, Minnesota, Alaska and Iowa.
        </li>
        <li>
          <strong>Tier B: county feeds.</strong> The state&apos;s own site blocks automated access, but its counties publish open files: Arizona, Pennsylvania, Texas, Ohio, Michigan, New York and Florida. Coverage is partial, and we label it as such.
        </li>
        <li>
          <strong>Tier C: delayed or community-edited.</strong> Where nothing machine-readable exists, we use hand-edited tables from <a href="https://en.wikipedia.org/wiki/2026_United_States_elections" target="_blank" rel="noopener noreferrer">Wikipedia</a>, published under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA</a>. Expect lags of minutes to hours.
        </li>
      </ul>

      <h2>2. Expected vote</h2>
      <p>
        &ldquo;Precincts reporting&rdquo; is a poor progress bar. Precincts differ in size, and feeds often report partial results. Like the AP, we estimate an <em>expected vote</em> for each county and show the share of it already counted. Our proxy is the largest of (a) votes counted so far, (b) the county&apos;s 2024 presidential turnout scaled by this cycle&apos;s statewide early-vote pace, and (c) early ballots returned plus an Election-Day estimate. When a feed gives only precinct counts, we use <code>votes × (1 − p) / p</code> with <code>p</code> capped at 0.95. We never show 100% until the county flags itself complete. We raise the estimate once counting passes 97% of it.
      </p>

      <h2>3. Benchmarks and &ldquo;needs X% of what&apos;s left&rdquo;</h2>
      <p>
        Each county gets a <em>benchmark margin</em>: its 2024 presidential margin shifted by the uniform swing implied by the pre-election consensus for the race. A county running ahead of its benchmark helps that candidate, even when they trail in raw votes there. For the statewide picture, we compute the share of the remaining expected vote the trailing candidate needs to pull even. Anything over 100% is marked <em>impossible</em>.
      </p>

      <h2>Flashback: polls against history</h2>
      <p>
        The <Link href="/history">Flashback</Link> page sets current polling against past elections. History covers presidential results by state since 1976, from the <a href="https://electionlab.mit.edu" target="_blank" rel="noopener noreferrer">MIT Election Data and Science Lab</a>. It adds Senate and governor margins since 1990 and House margins for 2022 and 2024, from <a href="https://en.wikipedia.org/wiki/2026_United_States_elections" target="_blank" rel="noopener noreferrer">Wikipedia</a>. A place&apos;s <em>projected margin</em> is its race poll average where one exists. Where none exists, it is the 2024 presidential margin moved by the national swing since 2024. The swing comes from the <Link href="/explainers#generic-ballot">generic ballot</Link>, measured against the 2024 popular vote. We apply the swing on a logit scale so lopsided places stay bounded. <em>Last this way</em> names the most recent election whose margin was at least as far toward the projected side. &ldquo;None&rdquo; means no election in the data was.
      </p>
      <p>
        We show polls as published, and we do not adjust for past poll error. No published estimate of this year&apos;s polling miss exists yet, and the direction has flipped from cycle to cycle. A Senate or governor poll gets compared against presidential history, so candidate strength shows up as extra &ldquo;change&rdquo;. House history is comparable only within a map era, so districts redrawn for 2024 or 2026 carry a caveat.
      </p>

      <h2>4. The projection band</h2>
      <p>
        Counties that have reported at least 20% of their expected vote contribute a residual (actual − benchmark). We pool residuals within clusters (urban, suburban or rural, by region). Each county&apos;s own residual is blended with its cluster&apos;s, in proportion to how much it has reported. We then sum the projected margins, weighted by expected vote. The uncertainty band is a heuristic that shrinks as the count comes in. It is not a probabilistic forecast.
      </p>

      <h2>5. When we say &ldquo;Projected&rdquo;</h2>
      <p>We mark a race projected when either condition below holds for two consecutive updates:</p>
      <ul>
        <li>the leader&apos;s vote margin exceeds the total votes we still expect to count, or</li>
        <li>
          at least half the expected vote is in, and the leader&apos;s margin in points exceeds the larger of 2 points and the model band.
        </li>
      </ul>
      <p>
        We handle Georgia&apos;s majority requirement explicitly. If no candidate can reach 50% + 1, we mark the race <em>runoff</em> (Dec 1, 2026).
      </p>

      <h2>6. Vote-order warnings (&ldquo;mirage&rdquo; badges)</h2>
      <p>
        States count ballots in different orders. North Carolina and Georgia post early and mail ballots first, so the first numbers skew Democratic. Wisconsin&apos;s big cities report absentee ballots late, so early numbers skew Republican. Where a feed breaks votes out by method, we show which methods have reported. Elsewhere, we badge the state from its published counting procedure.
      </p>

      <h2>7. Balance of power</h2>
      <p>
        Our projection rule decides which seats count as called. Uncalled seats show as <em>leaning</em> by the median of three rating sources: <a href="https://www.cookpolitical.com" target="_blank" rel="noopener noreferrer">Cook Political Report</a>, <a href="https://insideelections.com" target="_blank" rel="noopener noreferrer">Inside Elections</a> and <a href="https://centerforpolitics.org/crystalball/" target="_blank" rel="noopener noreferrer">Sabato&apos;s Crystal Ball</a>. We read those ratings from Wikipedia&apos;s CC BY-SA tables, and toss-ups sit in the middle. We also include Senate seats not up this year, so the bar shows the full chamber. See the <Link href="/senate">Senate</Link> and <Link href="/house">House</Link> pages.
      </p>

      <h2>What we leave out</h2>
      <ul>
        <li>We do not scrape or redisplay results feeds from the New York Times, CNN, Politico or other media outlets.</li>
        <li>We do not republish AP, network or Decision Desk race calls.</li>
        <li>We never present the model band as a probability of winning.</li>
      </ul>
    </article>
  );
}
