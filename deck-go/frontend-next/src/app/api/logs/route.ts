import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(request, `/api/v1/logs${search}`);
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
