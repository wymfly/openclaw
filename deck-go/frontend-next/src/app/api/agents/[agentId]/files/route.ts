import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ agentId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/files`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return deckGoUnavailableResponse();
}

export async function POST(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const body = (await request.clone().json()) as {
    name?: string;
    content?: string;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/files`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
