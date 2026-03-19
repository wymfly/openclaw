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

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  // Default workspace to name — Gateway resolves it relative to the user home.
  const workspace = body.workspace?.trim() || name;

  return gatewayRequest("agents.create", {
    name,
    workspace,
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
    deleteFiles: true,
  });
});
