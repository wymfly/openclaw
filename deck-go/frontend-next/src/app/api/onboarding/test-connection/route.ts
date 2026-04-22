import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

export async function POST(request: Request) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/onboarding/test-connection");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
