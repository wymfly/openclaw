/**
 * POST /api/chat/sessions/patch — Patch session directives via sessions.patch.
 *
 * Supports: model, thinkingLevel, fastMode, verboseLevel, reasoningLevel,
 *           responseUsage, sendPolicy.
 *
 * Gateway contract (`SessionsPatchParamsSchema`):
 *   { key, model?, thinkingLevel?, fastMode?, verboseLevel?, reasoningLevel?,
 *     responseUsage?, sendPolicy?, ... }
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
    model?: string;
    thinkingLevel?: string;
    fastMode?: boolean;
    verboseLevel?: string;
    reasoningLevel?: string;
    responseUsage?: "off" | "tokens" | "full" | "on" | null;
    sendPolicy?: "allow" | "deny" | null;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const { sessionKey, ...params } = body;
  return gwRequest("sessions.patch", { key: sessionKey, ...params });
});
