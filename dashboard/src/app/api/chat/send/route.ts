/**
 * POST /api/chat/send — Send a message via sessions.send.
 *
 * Gateway contract (`SessionsSendParamsSchema`):
 *   { key, message, thinking?, attachments?, timeoutMs?, idempotencyKey? }
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    message?: string;
    sessionKey?: string;
    thinking?: string;
    idempotencyKey?: string;
    attachments?: Array<{
      type?: string;
      mimeType?: string;
      fileName?: string;
      content: string;
    }>;
  };

  if (!body.message?.trim() && (!body.attachments || body.attachments.length === 0)) {
    return Response.json({ error: "message or attachment required" }, { status: 400 });
  }
  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const idempotencyKey = body.idempotencyKey?.trim() || randomUUID();

  return gwRequest("sessions.send", {
    key: body.sessionKey,
    message: body.message ?? "",
    thinking: body.thinking ?? undefined,
    idempotencyKey,
    ...(body.attachments && body.attachments.length > 0 ? { attachments: body.attachments } : {}),
  });
});
