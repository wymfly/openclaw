/**
 * GET /api/usage/timeseries — Fetch usage timeseries data from the Gateway.
 *
 * Gateway contract (`sessions.usage.timeseries`): { key?, startDate?, endDate?, mode?, utcOffset? }
 */
import { NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localUsageTimeseriesHandler(request: NextRequest) {
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
}

const guardedLocalUsageTimeseriesHandler = withAuth(localUsageTimeseriesHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/usage/timeseries${search}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalUsageTimeseriesHandler(request);
}
