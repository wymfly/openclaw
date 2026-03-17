/**
 * GET /api/cron/status — Fetch cron service status.
 *
 * Gateway contract: cron.status {}
 */
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gatewayRequest("cron.status", {});
});
