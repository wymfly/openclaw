import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

export async function GET(request: Request): Promise<Response> {
  const proxied = await fetchDeckGo(request, "/api/v1/logs/stream");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
