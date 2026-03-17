/**
 * GET /api/usage/timeseries — Fetch usage timeseries data from the Gateway.
 *
 * Gateway contract (`sessions.usage.timeseries`): { days?: number }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const days = request.nextUrl.searchParams.get("days") ?? "1";
  return gatewayRequest("sessions.usage.timeseries", { days: parseInt(days, 10) });
});
