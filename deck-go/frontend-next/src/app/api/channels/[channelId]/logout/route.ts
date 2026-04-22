/**
 * /api/channels/[channelId]/logout — Disconnect a channel.
 *
 * POST — Logout/disconnect the specified channel
 *
 * Gateway contract:
 *   channels.logout: { channelId: string }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ channelId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localChannelLogoutHandler(_request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as RouteContext).params;
  return gwRequest("channels.logout", { channel: channelId });
}

const guardedLocalChannelLogoutHandler = withAuth(localChannelLogoutHandler);

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
  return guardedLocalChannelLogoutHandler(request, ctx);
}
