import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ jobId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(
      jobId,
    )}/runs${search}`,
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
