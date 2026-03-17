/**
 * /api/channels/[channelId]/logout — Disconnect a channel.
 *
 * POST — Logout/disconnect the specified channel
 *
 * Gateway contract:
 *   channels.logout: { channelId: string }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ channelId: string }> };

export const POST = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { channelId } = await (ctx as RouteContext).params;
  return gatewayRequest("channels.logout", { channel: channelId });
});
