/**
 * GET /api/sessions — List all sessions.
 *
 * Gateway contract (`sessions.list`): {} (no params required).
 */
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gatewayRequest("sessions.list", {});
});
