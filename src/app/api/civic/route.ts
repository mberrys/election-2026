import type { NextRequest } from "next/server";
import { z } from "zod";
import { CivicError, civicConfigured, lookupBallot } from "@/lib/civic";
import { allow } from "@/lib/rate-limit";

export const maxDuration = 20;

const Body = z.object({ address: z.string().trim().min(5).max(200) });

/** Same-origin only and never cached: the response is about one person's address. */
function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Whether ballot lookup is available (the key is set); never calls Google. */
export async function GET() {
  return reply({ configured: civicConfigured() });
}

/**
 * POST { address } -> polling places, early-vote sites and contests from the Google Civic Information API.
 * POST rather than GET keeps the address out of URLs, access logs and caches. The address is passed through
 * and not stored or logged here.
 */
export async function POST(request: NextRequest) {
  if (!civicConfigured()) return reply({ error: "Ballot lookup is not set up on this site yet." }, 503);

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await allow(`civic:${ip}`, 8, 60))) return reply({ error: "Too many lookups. Wait a minute and try again." }, 429);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return reply({ error: "Send a JSON body with an address." }, 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return reply({ error: "Enter a full street address, city and state." }, 400);

  try {
    return reply(await lookupBallot(parsed.data.address));
  } catch (e) {
    if (e instanceof CivicError) {
      const status = e.kind === "bad-address" ? 422 : e.kind === "no-data" ? 404 : e.kind === "not-configured" ? 503 : 502;
      return reply({ error: e.message }, status);
    }
    console.error("civic lookup failed");
    return reply({ error: "The ballot lookup service is unavailable right now." }, 502);
  }
}
