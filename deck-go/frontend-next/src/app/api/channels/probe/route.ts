import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "GET",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels?probe=true`,
  );
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  if (!proxied.ok) {
    return proxied;
  }
  const payload = (await proxied.json()) as { payload?: unknown };
  return NextResponse.json(payload.payload ?? {});
}
