import { getRunAggregator } from "@server/run-aggregator";
/**
 * GET /api/monitor/stats — Aggregate overview statistics for all runs.
 *
 * Returns: OverviewStats { totalRuns, todayRuns, avgDurationMs, topAgents }
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const stats = getRunAggregator().getStats();
  return NextResponse.json(stats);
});
