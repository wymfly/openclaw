/**
 * GET /api/gateway/health — Gateway health check.
 *
 * Calls `health` RPC to retrieve health details (sessions, channels, auth).
 */
import { gatewayRequest } from "@/lib/api-helpers";

export async function GET() {
  return gatewayRequest("health", {});
}
