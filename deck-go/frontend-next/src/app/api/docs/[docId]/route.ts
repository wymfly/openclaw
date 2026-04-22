import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ docId: string }> };

export async function GET(request: NextRequest, ctx: unknown) {
  const { docId } = await (ctx as RouteContext).params;
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/docs/${encodeURIComponent(docId)}`);
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { docId } = await (ctx as RouteContext).params;
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/docs/${encodeURIComponent(docId)}`);
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
