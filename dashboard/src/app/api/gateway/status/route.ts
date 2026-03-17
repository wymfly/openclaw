/**
 * GET /api/gateway/status — Gateway status summary.
 *
 * Calls `status` RPC to retrieve session count, channels, and heartbeat info.
 */
import { gatewayRequest } from "@/lib/api-helpers";

export async function GET() {
  return gatewayRequest("status", {});
}
