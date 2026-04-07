/**
 * GET /api/gateway/status — Gateway status summary.
 *
 * Calls `status` RPC to retrieve session count, channels, and heartbeat info.
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("status", {});
});
