import { getRunAggregator } from "@server/run-aggregator";
/**
 * GET /api/monitor/stats — Aggregate overview statistics for all runs.
 *
 * Returns: OverviewStats { totalRuns, todayRuns, avgDurationMs, topAgents }
 */
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localMonitorStatsGetHandler(_request: NextRequest) {
  const stats = getRunAggregator().getStats();
  return NextResponse.json(stats);
}

const guardedLocalMonitorStatsGetHandler = withAuth(localMonitorStatsGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/stats`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { stats?: unknown };
    return NextResponse.json(payload.stats ?? {});
  }
  return guardedLocalMonitorStatsGetHandler(request);
}
