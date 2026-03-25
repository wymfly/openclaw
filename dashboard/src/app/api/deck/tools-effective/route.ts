/**
 * POST /api/deck/tools-effective — Get effective tools after policy filtering.
 *
 * Gateway contract:
 *   Params: { agentId?, sessionKey? }
 *   Returns: { groups[{ name, tools[{ id, name, allowed, source }] }] }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    agentId?: string;
    sessionKey?: string;
  };
  return gatewayRequest("tools.effective", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.sessionKey ? { sessionKey: body.sessionKey } : {}),
  });
});
