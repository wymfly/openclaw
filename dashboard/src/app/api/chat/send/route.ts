/**
 * POST /api/chat/send — Send a chat message through the Gateway.
 */
import { NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    message?: string;
    sessionKey?: string;
    agentId?: string;
  };

  if (!body.message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("chat.send", {
    message: body.message,
    sessionKey: body.sessionKey ?? undefined,
    agentId: body.agentId ?? undefined,
    ...platform,
  });
}
