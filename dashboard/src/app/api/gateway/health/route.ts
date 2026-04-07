/**
 * GET /api/gateway/health — Gateway health check.
 *
 * Calls `health` RPC to retrieve health details (sessions, channels, auth).
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("health", {});
});
