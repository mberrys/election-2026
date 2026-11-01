import type { Metadata } from "next";
import { BallotLookupSection } from "@/components/ballot/ballot-lookup";
import { buildBallotIndex } from "@/components/ballot/ballot-races";
import { ElectionDay } from "@/components/ballot/election-day";
import { GetReady } from "@/components/ballot/get-ready";
import { loadRaces, loadStates } from "@/data/reference/load";
import { civicConfigured } from "@/lib/civic";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Find Your Polling Place and Ballot for Nov 3, 2026",
  description:
    "Check your registration with Vote.org, find your polling place and see the contests on your ballot for the Nov 3, 2026 election. Each Senate, House and governor race links to its page.",
  path: "/ballot",
});

export default function BallotPage() {
  // Whether the Google Civic key is set: without it the page leads with the state picker instead of an address form that can only fail.
  const configured = civicConfigured();
  const index = buildBallotIndex(loadRaces(), loadStates());

  return (
    <article className="max-w-6xl space-y-10">
      <header className="page-header">
        <h1 className="page-title">My Ballot</h1>
        <p className="page-lede">Check your registration, find where to vote and see what&apos;s on your ballot.</p>
      </header>

      <ElectionDay />

      {/* Phone: one column in reading order. Desktop: the Vote.org checklist beside the lookup, both in the first screen. */}
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <GetReady />
        <div className="space-y-12">
          <BallotLookupSection configured={configured} index={index} />
        </div>
      </div>
    </article>
  );
}
