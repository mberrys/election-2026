import { redirect } from "next/navigation";
import { loadRaces } from "@/data/reference/load";

/** /senate/GA → /state/GA (the state board shows every race in the state, Senate included). */
export function generateStaticParams() {
  const abbrs = [...new Set(loadRaces().filter((r) => r.office === "senate").map((r) => r.state))];
  return abbrs.flatMap((s) => [{ state: s }, { state: s.toLowerCase() }]);
}

export default async function SenateStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  redirect(`/state/${state.slice(0, 2).toUpperCase()}`);
}
