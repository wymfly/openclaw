/**
 * /api/config/schema — Get configuration JSON Schema.
 *
 * GET — Get the JSON Schema for openclaw configuration
 *
 * Gateway contract:
 *   config.schema: {} (no params)
 *   Returns: JSON Schema object
 */
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gatewayRequest("config.schema", {});
});
