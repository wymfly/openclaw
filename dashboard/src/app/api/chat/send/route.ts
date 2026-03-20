/**
 * POST /api/chat/send — Send a chat message through the Gateway.
 *
 * Gateway contract (`ChatSendParamsSchema`):
 *   { sessionKey, message, thinking?, deliver?, attachments?, timeoutMs?, idempotencyKey }
 * Note: `additionalProperties: false` — do NOT inject platform headers into params.
 *
 * Body size: Next.js App Router body parsing is automatic via request.json().
 * For larger payloads (file attachments), configure bodyParser sizeLimit in next.config.ts.
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
    attachments?: Array<{
      type: string;
      mimeType: string;
      fileName: string;
      content: string;
    }>;
  };

  const hasMessage = !!body.message?.trim();
  const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0;

  if (!hasMessage && !hasAttachments) {
    return Response.json({ error: "message or attachments required" }, { status: 400 });
  }
  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const idempotencyKey = body.idempotencyKey?.trim() || randomUUID();

  return gatewayRequest("chat.send", {
    sessionKey: body.sessionKey,
    message: body.message ?? "",
    thinking: body.thinking ?? undefined,
    attachments: body.attachments ?? undefined,
    idempotencyKey,
  });
});
