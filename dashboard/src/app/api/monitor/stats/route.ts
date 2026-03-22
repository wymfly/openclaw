import { getRunEventStore } from "@server/run-event-store";
/**
 * GET /api/monitor/stats — Aggregate overview statistics for all runs.
 *
 * Returns: OverviewStats { totalRuns, todayRuns, avgDurationMs, topAgents }
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const store = getRunEventStore();
  const stats = store.getStats();
  return NextResponse.json(stats);
});
