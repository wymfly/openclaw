/**
 * /api/agents/[agentId] — Single agent operations.
 *
 * GET   — Get agent details (uses agents.list then filters)
 * PATCH — Update agent configuration
 *
 * Gateway contracts:
 *   agents.list:   {} (no params, returns all agents)
 *   agents.update: { agentId, name?, workspace?, model?, avatar? }
 */
import { type NextRequest, NextResponse } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { agentId } = await (ctx as RouteContext).params;
  // agents.list takes no params; filter client-side
  const res = await gatewayRequest("agents.list", {});
  if (res.status !== 200) {
    return res;
  }
  const data = (await res.json()) as {
    agents?: Array<{ id: string }>;
  };
  const agent = data.agents?.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
});

export const PATCH = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { agentId } = await (ctx as RouteContext).params;
  const body = (await request.json()) as {
    name?: string;
    workspace?: string;
    model?: string;
    avatar?: string;
  };

  return gatewayRequest("agents.update", {
    agentId,
    ...(body.name ? { name: body.name } : {}),
    ...(body.workspace ? { workspace: body.workspace } : {}),
    ...(body.model ? { model: body.model } : {}),
    ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
  });
});
