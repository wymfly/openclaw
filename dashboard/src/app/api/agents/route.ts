/**
 * /api/agents — Manage agents.
 *
 * GET    — List all agents
 * POST   — Create a new agent
 * DELETE — Delete an agent by ID
 *
 * Gateway contracts:
 *   agents.list:   {} (no params)
 *   agents.create: { name, workspace, emoji?, avatar? }
 *   agents.delete: { agentId, deleteFiles? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gatewayRequest("agents.list", {});
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    name?: string;
    workspace?: string;
    emoji?: string;
    avatar?: string;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.workspace?.trim()) {
    return Response.json({ error: "workspace is required" }, { status: 400 });
  }

  return gatewayRequest("agents.create", {
    name: body.name.trim(),
    workspace: body.workspace.trim(),
    ...(body.emoji ? { emoji: body.emoji } : {}),
    ...(body.avatar ? { avatar: body.avatar } : {}),
  });
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  return gatewayRequest("agents.delete", {
    agentId,
  });
});
