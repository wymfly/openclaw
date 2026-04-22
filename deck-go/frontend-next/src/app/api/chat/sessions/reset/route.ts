import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function POST(request: NextRequest) {
  const body = (await request.clone().json()) as {
    sessionKey?: string;
    reason?: "new" | "reset";
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "POST",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: body.reason ?? "reset" }),
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      body.sessionKey,
    )}:reset`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: body.sessionKey });
  }
  return deckGoUnavailableResponse();
}
