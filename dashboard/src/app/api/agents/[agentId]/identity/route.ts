/**
 * GET /api/agents/[agentId]/identity — Get agent identity.
 *
 * Gateway contract: agent.identity.get { agentId }
 * Returns: { agentId, name?, avatar?, emoji? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { agentId } = await (ctx as RouteContext).params;
  return gatewayRequest("agent.identity.get", { agentId });
});
