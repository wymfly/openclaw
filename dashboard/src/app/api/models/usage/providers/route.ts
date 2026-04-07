/**
 * GET /api/models/usage/providers — Provider usage/quota status.
 *
 * Calls `usage.status` RPC to retrieve per-provider quota windows.
 *
 * Gateway contract: {} (no params)
 * → UsageSummary { updatedAt, providers: ProviderUsageSnapshot[] }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("usage.status", {});
});
