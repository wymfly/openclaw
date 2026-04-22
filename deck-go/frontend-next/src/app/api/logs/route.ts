/**
 * GET /api/logs — Tail gateway log lines.
 *
 * Gateway contract (`logs.tail`):
 *   Params: { cursor?: number, limit?: number (max 5000, default 500), maxBytes?: number }
 *   Returns: { file, cursor, size, lines[], truncated?, reset? }
 *
 * Note: logs.tail does NOT support level/source/session filters.
 * All filtering is done at render time in LogStream.
 */
import { NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localLogsHandler(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = request.nextUrl.searchParams.get("limit") ?? "500";
  const maxBytes = request.nextUrl.searchParams.get("maxBytes");
  return gatewayRequest("logs.tail", {
    ...(cursor ? { cursor: parseInt(cursor, 10) } : {}),
    limit: parseInt(limit, 10),
    ...(maxBytes ? { maxBytes: parseInt(maxBytes, 10) } : {}),
  });
}

const guardedLocalLogsHandler = withAuth(localLogsHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(request, `/api/v1/logs${search}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalLogsHandler(request);
}
