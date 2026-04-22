/**
 * GET /api/monitor/stats — Aggregate overview statistics for all runs.
 *
 * Returns: OverviewStats { totalRuns, todayRuns, avgDurationMs, topAgents }
 */
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/stats`,
  );
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  if (!proxied.ok) {
    return proxied;
  }
  const payload = (await proxied.json()) as { stats?: unknown };
  return NextResponse.json(payload.stats ?? {});
}
