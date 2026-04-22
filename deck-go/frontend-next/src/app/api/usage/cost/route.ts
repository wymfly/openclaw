/**
 * GET /api/usage/cost — Fetch usage cost breakdown from the Gateway.
 *
 * Gateway contract (`usage.cost`): { days?: number }
 */
import { NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localUsageCostHandler(request: NextRequest) {
  const days = request.nextUrl.searchParams.get("days") ?? "1";
  return gatewayRequest("usage.cost", { days: parseInt(days, 10) });
}

const guardedLocalUsageCostHandler = withAuth(localUsageCostHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/usage/cost${search}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalUsageCostHandler(request);
}
