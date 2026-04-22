/**
 * GET /api/channels/[channelId]/throughput — Channel throughput summary.
 *
 * Phase 0 fallback:
 * We do not yet have an authoritative historical throughput source wired into
 * Deck/Gateway. Return an empty, explicit dataset so the UI has a stable route
 * surface without inventing traffic history.
 */
import { NextResponse, type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChannelThroughputGetHandler(_request: NextRequest, _ctx: unknown) {
  return NextResponse.json({
    buckets: [],
    messagesIn: 0,
    messagesOut: 0,
  });
}

const guardedLocalChannelThroughputGetHandler = withAuth(localChannelThroughputGetHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as { params: Promise<{ channelId: string }> }).params;
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels/${encodeURIComponent(
      channelId,
    )}/throughput${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? { buckets: [], messagesIn: 0, messagesOut: 0 });
  }
  return guardedLocalChannelThroughputGetHandler(request, ctx);
}
