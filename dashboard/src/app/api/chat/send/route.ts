/**
 * POST /api/chat/send — Send a chat message through the Gateway.
 *
 * Gateway contract (`ChatSendParamsSchema`):
 *   { sessionKey, message, thinking?, deliver?, attachments?, timeoutMs?, idempotencyKey }
 * Note: `additionalProperties: false` — do NOT inject platform headers into params.
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    message?: string;
    sessionKey?: string;
    thinking?: string;
    idempotencyKey?: string;
  };

  if (!body.message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const idempotencyKey = body.idempotencyKey?.trim() || randomUUID();

  return gatewayRequest("chat.send", {
    sessionKey: body.sessionKey,
    message: body.message,
    thinking: body.thinking ?? undefined,
    idempotencyKey,
  });
});
