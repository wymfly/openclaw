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
  const apiBase =
    process.env.DECK_GO_API_BASE?.trim() ?? process.env.NEXT_PUBLIC_DECK_GO_API_BASE?.trim() ?? "";
  if (!apiBase) {
    return deckGoUnavailableResponse();
  }
  const body = await request.arrayBuffer();
  const response = await fetch(`${apiBase.replace(/\/+$/, "")}/api/v1/settings`, {
    method: "PUT",
    headers: new Headers({
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      ...(request.headers.get("authorization")
        ? { authorization: request.headers.get("authorization")! }
        : {}),
      ...(request.headers.get("x-deck-token")
        ? { "x-deck-token": request.headers.get("x-deck-token")! }
        : {}),
    }),
    body,
  });
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
