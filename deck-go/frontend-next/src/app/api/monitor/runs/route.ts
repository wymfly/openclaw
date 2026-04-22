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
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const VALID_STATUSES = new Set<RunStatus>(["completed", "error", "running"]);
const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2RunRecord = {
  runId: string;
  agentId: string | null;
  sessionKey: string | null;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  status: RunStatus;
  toolCalls: number;
  modelCalls: number;
  totalTokens: number;
};

function filterStage2Runs(runs: Stage2RunRecord[], searchParams: URLSearchParams) {
  const statusParam = searchParams.get("status") ?? undefined;
  const status =
    statusParam && VALID_STATUSES.has(statusParam as RunStatus)
      ? (statusParam as RunStatus)
      : undefined;

  let filtered = [...runs];
  const agentId = searchParams.get("agentId") ?? undefined;
  const sessionKey = searchParams.get("sessionKey") ?? undefined;
  const since = searchParams.get("since") ?? undefined;
  const until = searchParams.get("until") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10) || 20;

  if (agentId) {
    filtered = filtered.filter((run) => run.agentId === agentId);
  }
  if (sessionKey) {
    filtered = filtered.filter((run) => run.sessionKey === sessionKey);
  }
  if (status) {
    filtered = filtered.filter((run) => run.status === status);
  }
  if (since) {
    const sinceMs = new Date(since).getTime();
    filtered = filtered.filter((run) => new Date(run.firstEventAt).getTime() >= sinceMs);
  }
  if (until) {
    const untilMs = new Date(until).getTime();
    filtered = filtered.filter((run) => new Date(run.firstEventAt).getTime() <= untilMs);
  }

  filtered.sort((a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime());

  let startIdx = 0;
  if (cursor) {
    const cursorIdx = filtered.findIndex((run) => run.runId === cursor);
    if (cursorIdx >= 0) {
      startIdx = cursorIdx + 1;
    }
  }
  const page = filtered.slice(startIdx, startIdx + limit);
  const nextCursor =
    startIdx + limit < filtered.length ? (page[page.length - 1]?.runId ?? null) : null;

  return { runs: page, nextCursor };
}

async function localMonitorRunsGetHandler(request: NextRequest) {
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
}

const guardedLocalMonitorRunsGetHandler = withAuth(localMonitorRunsGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/runs`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { runs?: Stage2RunRecord[] };
    return NextResponse.json(filterStage2Runs(payload.runs ?? [], request.nextUrl.searchParams));
  }
  return guardedLocalMonitorRunsGetHandler(request);
}
