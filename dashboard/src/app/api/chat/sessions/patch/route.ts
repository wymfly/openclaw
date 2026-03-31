/**
 * POST /api/chat/sessions/patch — Patch session directives via sessions.patch.
 *
 * Supports: model, thinkingLevel, fastMode, verboseLevel.
 *
 * Gateway contract (`SessionsPatchParamsSchema`):
 *   { key, model?, thinkingLevel?, fastMode?, verboseLevel?, ... }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
    model?: string;
    thinkingLevel?: string;
    fastMode?: boolean;
    verboseLevel?: string;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const { sessionKey, ...params } = body;
  return gatewayRequest("sessions.patch", { key: sessionKey, ...params });
});
