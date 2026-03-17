/**
 * POST /api/chat/abort — Abort an in-progress chat response.
 *
 * Gateway contract (`ChatAbortParamsSchema`):
 *   { sessionKey, runId? }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
    runId?: string;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gatewayRequest("chat.abort", {
    sessionKey: body.sessionKey,
    runId: body.runId ?? undefined,
  });
});
