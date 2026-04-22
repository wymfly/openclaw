import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

export async function GET(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/usage/budget/evaluate");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
