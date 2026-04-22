import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

export async function GET(request: Request): Promise<Response> {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/stream");
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  return proxied;
}
