/**
 * GET /api/sessions — List all sessions.
 *
 * Gateway contract (`sessions.list`):
 *   Params: { search?, limit?, activeMinutes?, includeGlobal?, agentId? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const search = request.nextUrl.searchParams.get("search");
  const limit = request.nextUrl.searchParams.get("limit");
  const activeMinutes = request.nextUrl.searchParams.get("activeMinutes");

  return gatewayRequest("sessions.list", {
    ...(search ? { search } : {}),
    ...(limit ? { limit: parseInt(limit, 10) } : {}),
    ...(activeMinutes ? { activeMinutes: parseInt(activeMinutes, 10) } : {}),
  });
});
