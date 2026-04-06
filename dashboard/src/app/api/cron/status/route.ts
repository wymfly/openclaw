/**
 * GET /api/cron/status — Fetch cron service status.
 *
 * Gateway contract: cron.status {}
 */
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("cron.status", {});
});
