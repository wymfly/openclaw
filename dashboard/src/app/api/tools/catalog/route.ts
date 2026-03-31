/**
 * POST /api/tools/catalog — Get tools catalog for an agent.
 *
 * Gateway contract: tools.catalog { agentId?, includePlugins? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    agentId?: string;
    includePlugins?: boolean;
  };
  return gatewayRequest("tools.catalog", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.includePlugins !== undefined ? { includePlugins: body.includePlugins } : {}),
  });
});
