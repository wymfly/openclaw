/**
 * /api/config — Read gateway configuration.
 *
 * GET — Get current config and baseHash
 *
 * Gateway contract:
 *   config.get: {} (no params)
 *   Returns: { config: OpenClawConfig, baseHash: string, valid: boolean, exists: boolean }
 */
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("config.get", {});
});
