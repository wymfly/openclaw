import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChatSessionsClearPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    sessionKey?: string;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gwRequest("sessions.clear", {
    key: body.sessionKey,
  });
}

const guardedLocalChatSessionsClearPostHandler = withAuth(localChatSessionsClearPostHandler);

export async function POST(request: NextRequest) {
  const body = (await request.clone().json()) as {
    sessionKey?: string;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      body.sessionKey,
    )}:clear`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: body.sessionKey });
  }
  return guardedLocalChatSessionsClearPostHandler(request);
}
