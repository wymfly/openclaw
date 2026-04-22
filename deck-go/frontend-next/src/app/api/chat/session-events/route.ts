import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

async function localChatSessionEventsPostHandler(request: NextRequest) {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    sessionKey?: string;
  } | null;
  if (!body?.sessionKey?.trim()) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
  }
  if (body.action !== "subscribe" && body.action !== "unsubscribe") {
    return NextResponse.json({ error: "action must be subscribe or unsubscribe" }, { status: 400 });
  }

  try {
    if (body.action === "subscribe") {
      await runtime.adapter.subscribeSessionMessages(body.sessionKey);
    } else {
      await runtime.adapter.unsubscribeSessionMessages(body.sessionKey);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

const guardedLocalChatSessionEventsPostHandler = withAuth(localChatSessionEventsPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/chat/session-events");
  if (proxied) {
    return proxied;
  }
  return guardedLocalChatSessionEventsPostHandler(request);
}
