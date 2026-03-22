/**
 * /api/channels — Channel status.
 *
 * GET — List all channels and their status
 *
 * Gateway contract:
 *   channels.status: { probe?: boolean, timeoutMs?: number }
 *   Returns: { ts, channelOrder[], channelLabels{}, channels{}, channelAccounts{}, channelDefaultAccountId{} }
 */
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (req) => {
  const probe = new URL(req.url).searchParams.get("probe") === "true";
  return gatewayRequest("channels.status", { probe });
});
