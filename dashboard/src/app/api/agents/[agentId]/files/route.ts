/**
 * /api/agents/[agentId]/files — Agent file management.
 *
 * GET  — List agent files
 * POST — Write a file (body: { name, content })
 *
 * Gateway contracts:
 *   agents.files.list: { agentId }
 *   agents.files.set:  { agentId, name, content }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { agentId } = await (ctx as RouteContext).params;

  return gatewayRequest("agents.files.list", {
    agentId,
  });
});

export const POST = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { agentId } = await (ctx as RouteContext).params;
  const body = (await request.json()) as {
    name?: string;
    content?: string;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  return gatewayRequest("agents.files.set", {
    agentId,
    name: body.name.trim(),
    content: body.content,
  });
});
