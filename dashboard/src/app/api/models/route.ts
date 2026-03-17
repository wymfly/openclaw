/**
 * GET /api/models — Model catalog.
 *
 * Calls `models.list` RPC to retrieve available models from all providers.
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const platform = extractPlatformHeaders(request);
  return gatewayRequest("models.list", { ...platform });
}
