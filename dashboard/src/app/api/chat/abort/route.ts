/**
 * POST /api/chat/abort — Abort an in-progress chat response.
 */
import { NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    sessionKey?: string;
    agentId?: string;
  };

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("chat.abort", {
    sessionKey: body.sessionKey ?? undefined,
    agentId: body.agentId ?? undefined,
    ...platform,
  });
}
