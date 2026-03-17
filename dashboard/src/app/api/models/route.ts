/**
 * GET /api/models — Model catalog.
 *
 * Calls `models.list` RPC to retrieve available models from all providers.
 *
 * Gateway contract (`ModelsListParamsSchema`): {} (no params)
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("models.list", {});
});
