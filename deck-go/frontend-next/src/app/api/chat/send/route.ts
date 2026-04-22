/**
 * POST /api/chat/send — Send a message via sessions.send.
 *
 * Gateway contract (`SessionsSendParamsSchema`):
 *   { key, message, thinking?, attachments?, timeoutMs?, idempotencyKey? }
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChatSendPostHandler(request: NextRequest) {
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
}

const guardedLocalChatSendPostHandler = withAuth(localChatSendPostHandler);

export async function POST(request: NextRequest) {
  const cloned = request.clone();
  const body = (await cloned.json()) as {
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
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify({
        text: body.message ?? "",
        ...(body.attachments && body.attachments.length > 0 ? { attachments: body.attachments } : {}),
      }),
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      body.sessionKey,
    )}/messages:send`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { commandId?: string };
    return NextResponse.json({
      runId: payload.commandId,
      status: "started",
    });
  }
  return guardedLocalChatSendPostHandler(request);
}
