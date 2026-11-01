import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadPolls } from "@/data/reference/load";
import { shortDate, stateQa, type StateContentInput } from "./state-content";

/** Server-rendered questions and answers for a state, written as the questions people type into a search box. */
export function StateQa({ input, className }: { input: StateContentInput; className?: string }) {
  const qa = stateQa(input);
  const updated = shortDate(loadPolls().builtAt);
  return (
    <section aria-labelledby="state-qa-title" className={cn("space-y-5", className)}>
      <div className="space-y-1.5">
        <h2 id="state-qa-title" className="section-title">
          {input.state.name} election questions
        </h2>
        {updated && <p className="text-sm text-muted-foreground">Polls and ratings updated {updated}</p>}
      </div>
      <Card size="sm">
        <CardContent className="space-y-5">
          {qa.map((item) => (
            <div key={item.q}>
              <h3 className="text-base font-semibold">{item.q}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
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
