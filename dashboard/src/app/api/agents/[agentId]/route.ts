/**
 * /api/agents/[agentId] — Single agent operations.
 *
 * GET   — Get agent configuration
 * PATCH — Update agent configuration
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { agentId } = await context.params;
  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.list", {
    agentId,
    ...platform,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { agentId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.update", {
    agentId,
    ...body,
    ...platform,
  });
}
