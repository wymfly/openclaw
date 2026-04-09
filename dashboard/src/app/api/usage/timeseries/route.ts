/**
 * GET /api/usage/timeseries — Fetch usage timeseries data from the Gateway.
 *
 * Gateway contract (`sessions.usage.timeseries`): { key?, startDate?, endDate?, mode?, utcOffset? }
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const key = sp.get("key");
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const rawMode = sp.get("mode");
  const utcOffset = sp.get("utcOffset");
  return gwRequest("sessions.usage.timeseries", {
    ...(key ? { key } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(rawMode ? { mode: rawMode as "utc" | "gateway" | "specific" } : {}),
    ...(utcOffset ? { utcOffset } : {}),
  });
});
