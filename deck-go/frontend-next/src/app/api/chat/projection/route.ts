import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

type ProjectionBody = {
  sessionKey?: string;
  a2uiState?: unknown;
};

async function validateProjectionBody(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ProjectionBody | null;
  const sessionKey = body?.sessionKey?.trim();

  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  const invalid = await validateProjectionBody(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/chat/projection");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
