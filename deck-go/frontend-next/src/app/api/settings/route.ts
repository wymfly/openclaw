import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/settings");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function PATCH(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/settings", { method: "PUT" });
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
