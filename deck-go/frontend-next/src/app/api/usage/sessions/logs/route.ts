/**
 * GET /api/usage/sessions/logs — Proxy sessions.usage.logs RPC.
 *
 * Query params: key, limit
 */
import { NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { SessionsUsageLogsParams } from "@/types/gateway-protocol.generated";

async function localUsageSessionLogsHandler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const key = sp.get("key") ?? "";
  const limit = sp.get("limit");

  const params: SessionsUsageLogsParams = { key };
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      params.limit = parsed;
    }
  }

  return gwRequest("sessions.usage.logs", params);
}

const guardedLocalUsageSessionLogsHandler = withAuth(localUsageSessionLogsHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/usage/sessions/logs${search}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalUsageSessionLogsHandler(request);
}
