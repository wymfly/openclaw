/**
 * GET /api/models/usage/providers — Provider usage/quota status.
 *
 * Calls `usage.status` RPC to retrieve per-provider quota windows.
 *
 * Gateway contract: {} (no params)
 * → UsageSummary { updatedAt, providers: ProviderUsageSnapshot[] }
 */
import { type NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localModelsUsageProvidersGetHandler(_request: NextRequest) {
  return gatewayRequest("usage.status", {});
}

const guardedLocalModelsUsageProvidersGetHandler = withAuth(localModelsUsageProvidersGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/models/usage/providers");
  if (proxied) {
    return proxied;
  }
  return guardedLocalModelsUsageProvidersGetHandler(request);
}
