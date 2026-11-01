"use client";

import { useMounted } from "@/hooks/use-mounted";
import { format } from "@/i18n/format";

type Moment = { label: string; iso: string };

/**
 * Election night in the visitor's own time zone, read from the browser. Renders nothing until mounted. The heading is a
 * catalog template with a `{zone}` placeholder; weekdays and clock times follow the page's language (`locale`).
 */
export function YourTime({ moments, heading, locale }: { moments: Moment[]; heading: string; locale?: string }) {
  const mounted = useMounted();
  if (!mounted) return null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "long", hour: "numeric", minute: "2-digit" });
  return (
    <div className="rounded-lg bg-card px-6 py-5">
      <p className="text-base font-semibold">{format(heading, { zone: zone.replace(/_/g, " ") })}</p>
      <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {moments.map((m) => (
          <div key={m.label}>
            <dt className="text-sm text-muted-foreground">{m.label}</dt>
            <dd className="mt-0.5 text-lg font-bold tnum">{fmt.format(new Date(m.iso))}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
