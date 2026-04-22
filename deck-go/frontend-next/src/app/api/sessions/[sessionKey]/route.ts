import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type RouteContext = { params: Promise<{ sessionKey: string }> };

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { sessionKey } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "DELETE",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      sessionKey,
    )}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: sessionKey });
  }
  return deckGoUnavailableResponse();
}
