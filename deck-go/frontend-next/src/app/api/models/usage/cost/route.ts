/**
 * GET /api/models/usage/cost — Cost usage summary.
 *
 * Calls `usage.cost` RPC to retrieve daily cost breakdown.
 *
 * Gateway contract: { startDate?, endDate?, days?, mode?, utcOffset? }
 * → CostUsageSummary { updatedAt, days, daily: CostUsageDailyEntry[], totals }
 */
import { type NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localModelsUsageCostGetHandler(request: NextRequest) {
  const url = new URL(request.url);
  const days = url.searchParams.get("days");
  return gatewayRequest("usage.cost", days ? { days: Number(days) } : { days: 7 });
}

const guardedLocalModelsUsageCostGetHandler = withAuth(localModelsUsageCostGetHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/models/usage/cost${search}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalModelsUsageCostGetHandler(request);
}
