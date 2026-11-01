import Link from "next/link";
import { Countdown } from "./countdown";
import { textLink } from "./link-row";

export function ElectionDay() {
  return (
    <section aria-labelledby="election-day" className="rounded-lg bg-card px-5 py-6 sm:px-8 sm:py-7">
      <h2 id="election-day" className="section-title">
        Election Day is Tuesday, November 3
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
        <Countdown />
        Each state sets its own polling hours, so polls close at different times.{" "}
        <Link href="/election-night" className={textLink}>
          See poll closing times
        </Link>
        .
      </p>
    </section>
  );
}
