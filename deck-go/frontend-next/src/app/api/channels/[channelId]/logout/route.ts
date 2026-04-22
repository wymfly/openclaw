import { type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ channelId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function POST(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels/${encodeURIComponent(
      channelId,
    )}/logout`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
