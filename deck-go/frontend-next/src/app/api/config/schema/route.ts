import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/config/schema`,
  );
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  if (!proxied.ok) {
    return proxied;
  }
  const payload = (await proxied.json()) as { schema?: unknown };
  return NextResponse.json(payload.schema ?? {});
}
