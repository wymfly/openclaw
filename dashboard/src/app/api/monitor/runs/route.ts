import { getRunAggregator } from "@server/run-aggregator";
import type { RunStatus } from "@server/run-aggregator";
/**
 * GET /api/monitor/runs — Paginated list of execution runs with optional filters.
 *
 * Query params:
 *   - agentId, sessionKey, since, until, status, cursor, limit
 *
 * Returns: { runs: RunRecord[], nextCursor: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

const VALID_STATUSES = new Set<RunStatus>(["completed", "error", "running"]);

export const GET = withAuth(async (request: NextRequest) => {
  const aggregator = getRunAggregator();
  const { searchParams } = request.nextUrl;

  const statusParam = searchParams.get("status") ?? undefined;
  const status =
    statusParam && VALID_STATUSES.has(statusParam as RunStatus)
      ? (statusParam as RunStatus)
      : undefined;

  const result = aggregator.listRuns({
    agentId: searchParams.get("agentId") ?? undefined,
    sessionKey: searchParams.get("sessionKey") ?? undefined,
    since: searchParams.get("since") ?? undefined,
    until: searchParams.get("until") ?? undefined,
    status,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "20", 10) || 20,
  });

  return NextResponse.json(result);
});
