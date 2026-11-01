import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { genericBallot } from "@/components/history/build-view";
import { buildSchedule } from "@/components/election-night/schedule";
import { shortDate } from "@/components/state/state-content";
import { getRacesByOffice, loadHistory, loadPolls, loadRaces, loadStates } from "@/data/reference/load";
import { fmtMarginDR } from "@/lib/format";
import { pageMetadata } from "@/lib/page-meta";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo";

const TITLE = "2026 Election Explainers: Ratings, Polls, Mirages and More";
const DESCRIPTION =
  "Plain answers about the 2026 midterms: what Toss-up means, the generic ballot, blue and red mirages, ranked-choice voting, runoffs, who calls races, and how the Big Board projects results.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/explainers" });

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="underline-offset-2 hover:underline">
    {children}
  </Link>
);

export default function ExplainersPage() {
  const history = loadHistory();
  const byOffice = getRacesByOffice();
  const senate = byOffice.get("senate") ?? [];
  const special = senate.filter((r) => r.special).length;
  const governors = byOffice.get("governor")?.length ?? 0;
  const houseSeats = byOffice.get("house")?.length ?? 0;
  const g = genericBallot();
  const gDate = shortDate(g.asOf);
  const schedule = buildSchedule(loadStates(), loadRaces());
  const first = schedule[0];
  const last = schedule[schedule.length - 1];
  const years = history.years;

  const items: { id: string; q: string; body: ReactNode }[] = [
    {
      id: "ratings",
      q: "What does a Toss-up or Lean rating mean?",
      body: (
        <p>
          Race raters such as Cook Political Report, Inside Elections and Sabato&apos;s Crystal Ball place each race on a scale
          from Solid (or Safe) through Likely, Lean and Tilt to Toss-up. The Big Board maps them onto one nine-step scale: Solid D,
          Likely D, Lean D, Tilt D, Toss-up, Tilt R, Lean R, Likely R, Solid R. It shows the consensus, the median of the ratings
          available. A rating is a judgement about how competitive a race is. It is not a vote forecast and it is not the poll
          average.
        </p>
      ),
    },
    {
      id: "margin",
      q: "What does D+3 or R+5 mean?",
      body: (
        <p>
          Margins here are the Democratic share minus the Republican share, in percentage points. D+3 means the Democrat leads by 3
          points, R+5 means the Republican leads by 5, and Even is a tie. A poll average of Democrat 49.0% and Republican 46.5% is
          D+2.5. Undecided and third-party shares are not part of the margin.
        </p>
      ),
    },
    {
      id: "generic-ballot",
      q: "What is the generic ballot?",
      body: (
        <p>
          The generic ballot is a poll question that asks which party people would vote for in their U.S. House district, without
          naming candidates.
          {g.margin !== undefined && (
            <>
              {" "}
              The Big Board&apos;s current average is {fmtMarginDR(g.margin)}
              {gDate ? ` (as of ${gDate})` : ""}.
            </>
          )}{" "}
          It measures the national mood and says little about any single district, but it is the anchor the Big Board uses to
          project states and districts that have no polls of their own.
        </p>
      ),
    },
    {
      id: "projections",
      q: "How does the Big Board project races that have no polls?",
      body: (
        <p>
          Where a race has a poll average, the projection is that margin as published, with no adjustment for pollster bias. Where
          it does not, the 2024 presidential margin is moved by the national swing between 2024 and the current generic ballot,
          measured on a logit scale so that lopsided places such as DC do not overshoot. These are rough estimates that ignore
          candidate quality, incumbency and local issues. Details are on the <A href="/methodology">methodology page</A>.
        </p>
      ),
    },
    {
      id: "last-time",
      q: "What does “last time it voted this way” mean?",
      body: (
        <p>
          For each state, <A href="/history">Flashback</A> takes the projected margin and finds the most recent election in
          the dataset in which that state voted at least as far toward the same party. The presidential history covers{" "}
          {years.length} elections from {years[0]} to {years[years.length - 1]}; Senate and governor history starts in 1990; House
          history covers the current district map. “None {years[0]}–{years[years.length - 1]}” means no election in that range
          went as far. Senate and governor polls are compared with presidential history, so a strong or weak candidate shows up as
          extra change.
        </p>
      ),
    },
    {
      id: "mirage",
      q: "What are the blue mirage and the red mirage?",
      body: (
        <p>
          Election night counts do not arrive in a random order. Where early and mail ballots are reported first, which lean
          Democratic in recent elections, the first numbers look better for Democrats and the lead narrows as Election Day votes
          come in: a blue mirage. Where Election Day votes are reported first, the early numbers can look better for Republicans
          until mail ballots are counted: a red mirage. The order is set by each state&apos;s rules, so it differs from state to
          state. See which states report which way on the <A href="/election-night">election night schedule</A>.
        </p>
      ),
    },
    {
      id: "calls",
      q: "Who calls races on election night, and does the Big Board?",
      body: (
        <p>
          The Associated Press and the television networks call races. The Big Board does not call races and republishes no AP or
          network calls. It shows vote counts from official state and county election offices, and its own projection built from
          polls and the votes counted so far. See <A href="/sources">sources and licenses</A>.
        </p>
      ),
    },
    {
      id: "control",
      q: "How many seats decide control of the Senate and the House in 2026?",
      body: (
        <p>
          The House has 435 seats, so 218 is a majority, and all {houseSeats} are on the ballot. The Senate has 100 seats: 51 is a
          majority, and at 50-50 the Vice President breaks ties. {senate.length} Senate seats are on the ballot ({senate.length - special}{" "}
          regular elections and {special} special {special === 1 ? "election" : "elections"}), along with {governors} governorships.
          Follow them on the <A href="/senate">Senate</A>, <A href="/house">House</A> and <A href="/governors">governors</A>{" "}
          boards.
        </p>
      ),
    },
    {
      id: "ranked-choice",
      q: "What is ranked-choice voting, and where is it used in 2026?",
      body: (
        <p>
          In ranked-choice voting, voters rank candidates in order of preference. If nobody has a majority of first choices, the
          last-place candidate is eliminated and those ballots move to their next choice, and so on until someone passes 50%.
          Alaska uses top-four primaries with a ranked-choice general election, and Maine uses ranked-choice voting in its
          primaries and in federal general elections. A 2026 Alaska ballot measure would repeal Alaska&apos;s system; see the{" "}
          <A href="/state/AK">Alaska page</A>.
        </p>
      ),
    },
    {
      id: "runoffs",
      q: "What is a runoff election, and does Georgia have one?",
      body: (
        <p>
          A runoff is a second round between the top two candidates when nobody reaches the required share. Georgia requires a
          majority winner in its general elections for Senate, governor and U.S. House, so a race where no candidate passes 50% goes
          to a runoff. See the <A href="/state/GA">Georgia page</A>.
        </p>
      ),
    },
    {
      id: "poll-closing",
      q: "What time do polls close on election night?",
      body: (
        <p>
          The first polls close at {first?.label} in {first?.states.map((s) => s.name).join(" and ")}, and the last close after
          midnight Eastern{last?.overnight ? ` (${last.label}) in ${last.states.map((s) => s.name).join(" and ")}` : ""}. Every
          state is on the <A href="/election-night">poll closing times page</A>.
        </p>
      ),
    },
    {
      id: "my-ballot",
      q: "How do I find my polling place and see what is on my ballot?",
      body: (
        <p>
          Enter your address on <A href="/ballot">My Ballot</A> to see your polling place, early-voting sites and the contests on
          your ballot, using the Google Civic Information API. Early voting and mail-ballot deadlines differ by state, so confirm
          details with your state or county election office.
        </p>
      ),
    },
  ];

  return (
    <article className="max-w-3xl space-y-10">
      <JsonLd data={webPageJsonLd({ name: TITLE, description: DESCRIPTION, path: "/explainers", dateModified: loadPolls().builtAt })} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Explainers", path: "/explainers" }])} />
      <header className="space-y-1">
        <h1 className="page-title">2026 election explainers</h1>
        <p className="page-lede">Plain answers to the questions the board raises, with the numbers from the data on this site.</p>
      </header>

      <nav aria-label="On this page">
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {items.map((it) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                {it.q}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-4">
        {items.map((it) => (
          <section key={it.id} id={it.id} className="scroll-mt-20">
            <h2 className="section-title">{it.q}</h2>
            <Card size="sm" className="mt-2">
              <CardContent className="text-sm text-muted-foreground">{it.body}</CardContent>
            </Card>
          </section>
        ))}
      </div>
    </article>
  );
}
