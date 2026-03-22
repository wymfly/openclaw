import { getRunEventStore } from "@server/run-event-store";
import type { RunStatus } from "@server/run-event-store";
/**
 * GET /api/monitor/runs — Paginated list of execution runs with optional filters.
 *
 * Query params:
 *   - agentId (optional): filter by agent
 *   - sessionKey (optional): filter by session
 *   - since (optional): ISO timestamp lower bound
 *   - until (optional): ISO timestamp upper bound
 *   - status (optional): "completed" | "error" | "running"
 *   - cursor (optional): opaque cursor for pagination
 *   - limit (optional, default 20): page size
 *
 * Returns: { runs: RunListItem[], nextCursor: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

const VALID_STATUSES = new Set<RunStatus>(["completed", "error", "running"]);

export const GET = withAuth(async (request: NextRequest) => {
  const store = getRunEventStore();
  const { searchParams } = request.nextUrl;

  const statusParam = searchParams.get("status") ?? undefined;
  const status =
    statusParam && VALID_STATUSES.has(statusParam as RunStatus)
      ? (statusParam as RunStatus)
      : undefined;

  const result = store.listRuns({
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
