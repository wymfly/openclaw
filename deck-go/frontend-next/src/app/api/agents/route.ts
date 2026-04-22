import { type NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents`,
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

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function DELETE(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  const proxied =
    agentId == null
      ? null
      : await fetchDeckGo(
          request,
          `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(agentId)}`,
        );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
