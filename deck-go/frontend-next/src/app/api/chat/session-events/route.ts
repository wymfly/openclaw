import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

export async function POST(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/chat/session-events");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
