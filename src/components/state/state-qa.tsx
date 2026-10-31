import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { loadPolls } from "@/data/reference/load";
import { shortDate, stateQa, type StateContentInput } from "./state-content";

/** Server-rendered questions and answers for a state, written as the questions people type into a search box. */
export function StateQa({ input }: { input: StateContentInput }) {
  const qa = stateQa(input);
  const updated = shortDate(loadPolls().builtAt);
  return (
    <section aria-label={`Questions about the ${input.state.name} election`} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="display text-lg font-bold tracking-tight">{input.state.name} election questions</h2>
        {updated && <span className="text-xs text-muted-foreground">Polls and ratings updated {updated}</span>}
      </div>
      <Card size="sm">
        <CardContent className="space-y-4">
          {qa.map((item) => (
            <div key={item.q}>
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            More: <Link href="/election-night" className="underline-offset-2 hover:underline">poll closing times for every state</Link>
            {" · "}
            <Link href="/explainers" className="underline-offset-2 hover:underline">how the ratings, polls and projections work</Link>
            {" · "}
            <Link href="/ballot" className="underline-offset-2 hover:underline">look up your ballot</Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
