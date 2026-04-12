import { getRunAggregator } from "@server/run-aggregator";
/**
 * GET /api/monitor/runs/:runId — Single run detail: summary stats.
 *
 * Returns: { summary: RunSummary }
 * Returns 404 if the run is not tracked.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ runId: string }> };

export const GET = withAuth(async (_request: NextRequest, ...args: unknown[]) => {
  const ctx = args[0] as RouteContext;
  const { runId } = await ctx.params;

  const aggregator = getRunAggregator();
  const summary = aggregator.getRunSummary(runId);

  if (!summary) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ summary });
});
