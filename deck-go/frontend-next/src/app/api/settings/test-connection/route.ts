import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/settings/test-connection");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
