import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/http";
import type { BalanceOfPower } from "@/data/schema";
import { readHistory, readNational, readRace, readState } from "@/lib/snapshot-store";

export const maxDuration = 10;

/**
 * GET /api/results                      → national payload (races without county units)
 * GET /api/results?scope=state:NC       → all races in a state with county units
 * GET /api/results?scope=race:senate:GA → one race with units
 * GET /api/results?scope=history        → balance-of-power time series
 *
 * Served through the Vercel CDN with s-maxage=15 + SWR; every viewer polls this, origin sees ~4 req/min/region.
 */
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") ?? "national";

  if (scope === "history") {
    const rows = await readHistory(720);
    return jsonResponse(request, { rows }, { profile: "live" });
  }

  if (scope.startsWith("state:")) {
    const st = scope.slice(6).toUpperCase();
    if (!/^[A-Z]{2}$/.test(st)) return jsonResponse(request, { error: "bad state" }, { status: 400, profile: "none" });
    const data = await readState(st);
    return data
      ? jsonResponse(request, data, { profile: "live" })
      : jsonResponse(request, { state: st, races: [], generatedAt: null, seq: 0 }, { profile: "live" });
  }

  if (scope.startsWith("race:")) {
    const id = scope.slice(5);
    const race = await readRace(id);
    return race
      ? jsonResponse(request, race, { profile: "live" })
      : jsonResponse(request, { error: "not found", id }, { status: 404, profile: "none" });
  }

  const national = await readNational();
  return jsonResponse(request, national ?? EMPTY_NATIONAL, {
    profile: "live",
  });
}

const zero = { D: 0, R: 0, I: 0 };
const emptyBop = (office: BalanceOfPower["office"], total: number, majority: number): BalanceOfPower => ({
  office,
  total,
  majority,
  notUp: zero,
  called: zero,
  leaning: zero,
  tossup: 0,
});
/** Pre-snapshot payload keeps the NationalPayload shape (balance included) so consumers never see undefined. */
const EMPTY_NATIONAL = {
  version: 1,
  generatedAt: null,
  seq: 0,
  races: [],
  balance: { senate: emptyBop("senate", 100, 51), house: emptyBop("house", 435, 218), governor: emptyBop("governor", 36, 0) },
  feeds: [],
  notices: ["No snapshot yet"],
};
