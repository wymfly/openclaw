/**
 * /api/chat/sessions — Manage chat sessions.
 *
 * GET    — List all sessions
 * DELETE — Delete a session by key
 *
 * Gateway contracts:
 *   sessions.list:   { limit?, activeMinutes?, includeGlobal?, agentId?, ... }
 *   sessions.delete: { key, deleteTranscript? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  return gatewayRequest("sessions.list", {
    ...(agentId ? { agentId } : {}),
    includeDerivedTitles: true,
    includeLastMessage: true,
    limit: 50,
  });
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
  };

  if (!body.sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gatewayRequest("sessions.delete", {
    key: body.sessionKey,
  });
});
