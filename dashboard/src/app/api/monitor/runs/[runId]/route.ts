import { getRunEventStore } from "@server/run-event-store";
/**
 * GET /api/monitor/runs/:runId — Single run detail: events + summary.
 *
 * Returns: { events: RunEventRow[], summary: RunSummary }
 * Returns 404 if the run has no events.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ runId: string }> };

export const GET = withAuth(async (_request: NextRequest, ...args: unknown[]) => {
  const ctx = args[0] as RouteContext;
  const { runId } = await ctx.params;

  const store = getRunEventStore();
  const events = store.getRunEvents(runId);

  if (events.length === 0) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const summary = store.getRunSummary(runId);

  return NextResponse.json({ events, summary });
});
