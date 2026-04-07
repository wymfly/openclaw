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
  const key = sp.get("key") ?? undefined;
  const startDate = sp.get("startDate") ?? undefined;
  const endDate = sp.get("endDate") ?? undefined;
  const mode = sp.get("mode") as "utc" | "gateway" | "specific" | undefined;
  const utcOffset = sp.get("utcOffset") ?? undefined;
  return gwRequest("sessions.usage.timeseries", { key, startDate, endDate, mode, utcOffset });
});
