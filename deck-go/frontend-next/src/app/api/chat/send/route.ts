import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

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
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify({
        text: body.message ?? "",
        ...(body.attachments && body.attachments.length > 0
          ? { attachments: body.attachments }
          : {}),
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
  return deckGoUnavailableResponse();
}
