"use client";

import { useNational } from "@/hooks/use-results";
import { useMounted } from "@/hooks/use-mounted";

/** Full-width warning whenever the snapshot came from the election-night simulator. */
export function SimBanner() {
  const mounted = useMounted();
  const { data } = useNational();
  const notice = mounted ? data?.notices?.find((n) => n.startsWith("SIMULATION")) : undefined;
  if (!notice) return null;
  const clock = notice.match(/sim clock ([0-9T:.-]+Z)/)?.[1];
  const et = clock
    ? new Date(clock).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <div role="alert" className="bg-stale text-black text-center text-xs font-semibold tracking-wide py-1.5 px-4">
      SIMULATION: these are not real results{et ? ` · simulated time ${et} ET Nov 3` : ""}
    </div>
  );
}
