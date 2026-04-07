/**
 * /api/devices — Device management.
 *
 * GET — List all paired devices and pending pairing requests
 *
 * Gateway contract:
 *   device.pair.list: {}
 *   Returns: { pending[], approved[] }
 */
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("device.pair.list", {});
});
