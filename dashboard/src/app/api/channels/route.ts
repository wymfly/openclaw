/**
 * /api/channels — Channel status.
 *
 * GET — List all channels and their status.
 *
 * Query params:
 *   probe=true|false
 *   timeoutMs=<integer>
 *
 * Gateway contract:
 *   channels.status: { probe?: boolean, timeoutMs?: number }
 *   Returns: { ts, channelOrder[], channelLabels{}, channels{}, channelAccounts{}, channelDefaultAccountId{} }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

function parseBoolean(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function parseTimeoutMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export const GET = withAuth(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const probe = parseBoolean(searchParams.get("probe"));
  const timeoutMs = parseTimeoutMs(searchParams.get("timeoutMs"));

  return gwRequest("channels.status", {
    probe,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
});
