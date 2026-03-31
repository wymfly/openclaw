/**
 * GET /api/usage/sessions — Proxy sessions.usage RPC.
 *
 * Query params: startDate, endDate, limit
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const params: Record<string, unknown> = {};

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
    params.limit = parseInt(limit, 10);
  }

  return gatewayRequest("sessions.usage", params);
});
