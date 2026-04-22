/**
 * GET /api/usage/sessions — Proxy sessions.usage RPC.
 *
 * Query params: startDate, endDate, limit
 */
import { NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { SessionsUsageParams } from "@/types/gateway-protocol.generated";

async function localUsageSessionsHandler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: SessionsUsageParams = {};

  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const limit = sp.get("limit");

  if (startDate) {
    params.startDate = startDate;
  }
  if (endDate) {
    params.endDate = endDate;
  }
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      params.limit = parsed;
    }
  }

  const key = sp.get("key");
  if (key) {
    params.key = key;
  }
  if (sp.get("includeContextWeight") === "true") {
    params.includeContextWeight = true;
  }

  return gwRequest("sessions.usage", params);
}

const guardedLocalUsageSessionsHandler = withAuth(localUsageSessionsHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/usage/sessions${search}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalUsageSessionsHandler(request);
}
