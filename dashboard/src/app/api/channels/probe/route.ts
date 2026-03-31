/**
 * /api/channels/probe — Trigger active channel probe.
 *
 * POST — Calls channels.status with probe: true
 *
 * Gateway contract:
 *   channels.status: { probe: true }
 *   Returns: same shape as GET /api/channels but with probe results per account
 */
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async () => {
  return gatewayRequest("channels.status", { probe: true });
});
