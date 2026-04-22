/**
 * POST /api/chat/compact — Compact session context via sessions.compact.
 *
 * Gateway contract (`SessionsCompactParamsSchema`):
 *   { key }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChatCompactPostHandler(request: NextRequest) {
  const body = (await request.json()) as { sessionKey?: string };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gwRequest("sessions.compact", { key: body.sessionKey });
}

const guardedLocalChatCompactPostHandler = withAuth(localChatCompactPostHandler);

export async function POST(request: NextRequest) {
  const cloned = request.clone();
  const body = (await cloned.json()) as { sessionKey?: string };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      body.sessionKey,
    )}:compact`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true });
  }
  return guardedLocalChatCompactPostHandler(request);
}
