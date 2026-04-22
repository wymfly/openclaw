import { NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ jobId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(jobId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(jobId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
