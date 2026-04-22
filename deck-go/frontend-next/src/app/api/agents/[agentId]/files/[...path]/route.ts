import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ agentId: string; path: string[] }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId, path } = await (ctx as RouteContext).params;
  const filePath = path.map((part) => encodeURIComponent(part)).join("/");
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/files/${filePath}`,
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
