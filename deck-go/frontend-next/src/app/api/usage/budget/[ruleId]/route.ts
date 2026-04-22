import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { ruleId } = await (ctx as RouteContext).params;
  const proxied = await maybeProxyToDeckGo(
    request,
    `/api/v1/usage/budget/${encodeURIComponent(ruleId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { ruleId } = await (ctx as RouteContext).params;
  const proxied = await maybeProxyToDeckGo(
    request,
    `/api/v1/usage/budget/${encodeURIComponent(ruleId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
