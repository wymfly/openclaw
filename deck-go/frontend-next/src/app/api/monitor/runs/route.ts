/**
 * GET /api/monitor/runs — Paginated list of execution runs with optional filters.
 *
 * Query params:
 *   - agentId, sessionKey, since, until, status, cursor, limit
 *
 * Returns: { runs: RunRecord[], nextCursor: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RunStatus = "completed" | "error" | "running";
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

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/runs${search}`,
  );
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  if (!proxied.ok) {
    return proxied;
  }
  const payload = (await proxied.json()) as {
    runs?: Stage2RunRecord[];
    nextCursor?: string | null;
  };
  return NextResponse.json({
    runs: payload.runs ?? [],
    nextCursor: payload.nextCursor ?? null,
  });
}
