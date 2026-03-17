/**
 * /api/agents — Manage agents.
 *
 * GET    — List all agents
 * POST   — Create a new agent
 * DELETE — Delete an agent by ID
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const platform = extractPlatformHeaders(request);
  return gatewayRequest("agents.list", { ...platform });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    model?: string;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.create", {
    name: body.name.trim(),
    model: body.model ?? undefined,
    ...platform,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.delete", {
    agentId,
    ...platform,
  });
}
