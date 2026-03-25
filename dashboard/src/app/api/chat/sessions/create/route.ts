/**
 * POST /api/chat/sessions/create — Create a new session via Gateway.
 *
 * Gateway contract (`SessionsCreateParamsSchema`):
 *   { key?, agentId?, label?, model?, parentSessionKey?, task?, message? }
 * Returns: { ok, key, sessionId, entry, runStarted, messageSeq?, runError? }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    agentId?: string;
    message?: string;
    model?: string;
    label?: string;
    parentSessionKey?: string;
  };

  return gatewayRequest("sessions.create", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.message?.trim() ? { message: body.message } : {}),
    ...(body.model?.trim() ? { model: body.model } : {}),
    ...(body.label?.trim() ? { label: body.label } : {}),
    ...(body.parentSessionKey?.trim() ? { parentSessionKey: body.parentSessionKey } : {}),
  });
});
