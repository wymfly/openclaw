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
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChatSessionsPatchPostHandler(request: NextRequest) {
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
}

const guardedLocalChatSessionsPatchPostHandler = withAuth(localChatSessionsPatchPostHandler);

export async function POST(request: NextRequest) {
  const body = (await request.clone().json()) as {
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

  const { sessionKey, ...patch } = body;
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "POST",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        "content-type": "application/json",
      },
      body: JSON.stringify(patch),
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      sessionKey,
    )}:patch`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: sessionKey });
  }
  return guardedLocalChatSessionsPatchPostHandler(request);
}
