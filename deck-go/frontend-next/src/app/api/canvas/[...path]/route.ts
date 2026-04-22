import type { NextRequest } from "next/server";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  const suffix = path?.join("/") ?? "";
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/canvas/${suffix}`);
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
