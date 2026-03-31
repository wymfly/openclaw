/**
 * GET /api/usage/sessions/logs — Proxy sessions.usage.logs RPC.
 *
 * Query params: key, limit
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const key = sp.get("key") ?? "";
  const limit = sp.get("limit");

  const params: Record<string, unknown> = { key };
  if (limit) {
    params.limit = parseInt(limit, 10);
  }

  return gatewayRequest("sessions.usage.logs", params);
});
