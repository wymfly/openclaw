import { getRunAggregator } from "@server/run-aggregator";
/**
 * GET /api/monitor/runs/:runId — Single run detail: summary stats.
 *
 * Returns: { summary: RunSummary }
 * Returns 404 if the run is not tracked.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ runId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2RunRecord = {
  runId: string;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  toolCalls: number;
  modelCalls: number;
  fileOps: number;
  subagentSpawns: number;
  totalTokens: number;
  compacted: boolean;
};

type Stage2RunEventRow = {
  id: number;
  run_id: string;
  seq: number;
  stream: string;
  data: string;
  agent_id: string | null;
  session_key: string | null;
  created_at: string;
};

function toLegacySummary(run: Stage2RunRecord) {
  const firstMs = new Date(run.firstEventAt).getTime();
  const lastMs = new Date(run.lastEventAt).getTime();
  return {
    toolCalls: run.toolCalls,
    modelCalls: run.modelCalls,
    fileOps: run.fileOps,
    subagentSpawns: run.subagentSpawns,
    compacted: run.compacted,
    totalInputTokens: 0,
    totalOutputTokens: run.totalTokens ?? 0,
    totalCacheTokens: 0,
    durationMs: Math.max(0, lastMs - firstMs),
    eventCount: run.eventCount,
  };
}

async function localMonitorRunGetHandler(_request: NextRequest, ...args: unknown[]) {
  const ctx = args[0] as RouteContext;
  const { runId } = await ctx.params;

  const aggregator = getRunAggregator();
  const summary = aggregator.getRunSummary(runId);

  if (!summary) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ summary });
}

const guardedLocalMonitorRunGetHandler = withAuth(localMonitorRunGetHandler);

export async function GET(request: NextRequest, ...args: unknown[]) {
  const ctx = args[0] as RouteContext;
  const { runId } = await ctx.params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/runs/${encodeURIComponent(runId)}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { run?: Stage2RunRecord; events?: Stage2RunEventRow[] };
    return NextResponse.json({
      summary: payload.run ? toLegacySummary(payload.run) : null,
      events: payload.events ?? [],
    });
  }
  return guardedLocalMonitorRunGetHandler(request, ...args);
}
