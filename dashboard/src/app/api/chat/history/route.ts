/**
 * GET /api/chat/history — Fetch chat message history for a session.
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sessionKey = searchParams.get("sessionKey");
  const agentId = searchParams.get("agentId");

  if (!sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("chat.history", {
    sessionKey,
    agentId: agentId ?? undefined,
    ...platform,
  });
}
