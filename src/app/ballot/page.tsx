import type { Metadata } from "next";
import { BallotLookupForm } from "@/components/ballot/ballot-lookup";
import { pageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Find Your Polling Place and Ballot for Nov 3, 2026",
  description: "Enter your address to see your polling place, early-voting sites and the contests on your ballot for the Nov 3, 2026 election.",
  path: "/ballot",
});

export default function BallotPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="display text-2xl md:text-[1.75rem] font-bold tracking-tight">My Ballot</h1>
        <p className="text-sm text-muted-foreground">Polling place, early voting and contests for your address</p>
      </header>
      <BallotLookupForm />
      <p className="text-xs text-muted-foreground">Ballot information via the Google Civic Information API. Confirm details with your state or county election office.</p>
    </div>
  );
}
