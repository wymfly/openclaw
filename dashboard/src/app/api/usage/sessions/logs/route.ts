/**
 * GET /api/usage/sessions/logs — Proxy sessions.usage.logs RPC.
 *
 * Query params: key, limit
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { SessionsUsageLogsParams } from "@/types/gateway-protocol.generated";

export const GET = withAuth(async (request: NextRequest) => {
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
});
