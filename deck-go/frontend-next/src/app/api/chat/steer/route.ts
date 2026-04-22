/**
 * /api/chat/steer — Inject a steering instruction into a running session.
 *
 * POST — Steer a session mid-execution.
 *
 * Gateway contract:
 *   sessions.steer: { key: string, message: string } → { ok: boolean }
 */
import { type NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localChatSteerPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    sessionKey?: string;
    message?: string;
  };

  if (!body.sessionKey || !body.message) {
    return Response.json({ error: "sessionKey and message are required" }, { status: 400 });
  }

  return gwRequest("sessions.steer", {
    key: body.sessionKey,
    message: body.message,
  });
}

const guardedLocalChatSteerPostHandler = withAuth(localChatSteerPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/chat/steer");
  if (proxied) {
    return proxied;
  }
  return guardedLocalChatSteerPostHandler(request);
}
