/**
 * /api/agents/[agentId]/files — Agent file management.
 *
 * GET  — List agent files
 * POST — Write a file (body: { path, content })
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { agentId } = await context.params;
  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.files.list", {
    agentId,
    ...platform,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { agentId } = await context.params;
  const body = (await request.json()) as {
    path?: string;
    content?: string;
  };

  if (!body.path?.trim()) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.files.set", {
    agentId,
    path: body.path.trim(),
    content: body.content,
    ...platform,
  });
}
