/**
 * /api/chat/sessions — Manage chat sessions.
 *
 * GET    — List all sessions
 * DELETE — Delete a session by key
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const platform = extractPlatformHeaders(request);
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  return gatewayRequest("sessions.list", {
    agentId: agentId ?? undefined,
    ...platform,
  });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as {
    sessionKey?: string;
    agentId?: string;
  };

  if (!body.sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("sessions.delete", {
    sessionKey: body.sessionKey,
    agentId: body.agentId ?? undefined,
    ...platform,
  });
}
