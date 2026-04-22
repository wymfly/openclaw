import { NextResponse, type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as { params: Promise<{ channelId: string }> }).params;
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels/${encodeURIComponent(
      channelId,
    )}/throughput${search}`,
  );
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  if (!proxied.ok) {
    return proxied;
  }
  const payload = (await proxied.json()) as { payload?: unknown };
  return NextResponse.json(payload.payload ?? { buckets: [], messagesIn: 0, messagesOut: 0 });
}
