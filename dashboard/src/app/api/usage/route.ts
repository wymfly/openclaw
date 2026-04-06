/**
 * GET /api/usage — Fetch provider usage summary from the Gateway.
 *
 * Gateway contract (`usage.status`): no params required.
 */
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("usage.status", {});
});
