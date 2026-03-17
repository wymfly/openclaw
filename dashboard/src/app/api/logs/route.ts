/**
 * GET /api/logs — Tail gateway log lines.
 *
 * Gateway contract (`logs.tail`):
 *   Params: { cursor?: number, limit?: number (max 5000, default 500), maxBytes?: number }
 *   Returns: { file, cursor, size, lines[], truncated?, reset? }
 *
 * Note: logs.tail does NOT support level/source/session filters.
 * Client-side filtering is done in the useLogPolling hook.
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = request.nextUrl.searchParams.get("limit") ?? "500";
  return gatewayRequest("logs.tail", {
    ...(cursor ? { cursor: parseInt(cursor, 10) } : {}),
    limit: parseInt(limit, 10),
  });
});
