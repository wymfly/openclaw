import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ webhookId: string }> };

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(request, `/api/v1/webhooks/${encodeURIComponent(webhookId)}`);
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(request, `/api/v1/webhooks/${encodeURIComponent(webhookId)}`);
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
