/**
 * POST /api/chat/sessions/create — Create a new session via Gateway.
 *
 * Gateway contract (`SessionsCreateParamsSchema`):
 *   { key?, agentId?, label?, model?, parentSessionKey?, task?, message? }
 * Returns: { ok, key, sessionId, entry, runStarted, messageSeq?, runError? }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChatSessionsCreatePostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    agentId?: string;
    message?: string;
    model?: string;
    label?: string;
    parentSessionKey?: string;
  };

  return gwRequest("sessions.create", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.message?.trim() ? { message: body.message } : {}),
    ...(body.model?.trim() ? { model: body.model } : {}),
    ...(body.label?.trim() ? { label: body.label } : {}),
    ...(body.parentSessionKey?.trim() ? { parentSessionKey: body.parentSessionKey } : {}),
  });
}

const guardedLocalChatSessionsCreatePostHandler = withAuth(localChatSessionsCreatePostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: await request.clone().text(),
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions:create`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json(await proxied.json());
  }
  return guardedLocalChatSessionsCreatePostHandler(request);
}
