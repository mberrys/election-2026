import { NextResponse, type NextRequest } from "next/server";
import { usRedirectFor } from "@/lib/geo-gate";

/** Keeps the /world pages (written for readers outside the US), in English and in every translation, away from US visitors. Country comes from Vercel's edge. */
export function proxy(request: NextRequest) {
  const to = usRedirectFor(request.nextUrl.pathname, request.headers.get("x-vercel-ip-country"), request.headers.get("user-agent"));
  if (!to) return NextResponse.next();
  const res = NextResponse.redirect(new URL(to, request.url), 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * Matchers must be written out literally (Next reads them statically), so the language list below repeats
 * `TRANSLATED_LANGS`; tests/lib/world.test.ts fails if the two drift apart.
 */
export const config = {
  matcher: ["/world", "/world/:path*", "/(es|fr|de|pt|it|ja|ko|zh)/world", "/(es|fr|de|pt|it|ja|ko|zh)/world/:path*"],
};
