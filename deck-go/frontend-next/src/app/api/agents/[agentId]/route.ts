import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ agentId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(agentId)}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return deckGoUnavailableResponse();
}

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(agentId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
