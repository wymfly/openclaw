/**
 * GET /api/models/usage/cost — Cost usage summary.
 *
 * Calls `usage.cost` RPC to retrieve daily cost breakdown.
 *
 * Gateway contract: { startDate?, endDate?, days?, mode?, utcOffset? }
 * → CostUsageSummary { updatedAt, days, daily: CostUsageDailyEntry[], totals }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const days = url.searchParams.get("days");
  return gwRequest("usage.cost", days ? { days: Number(days) } : { days: 7 });
});
