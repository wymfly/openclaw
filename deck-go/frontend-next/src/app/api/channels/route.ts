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
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

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

async function localChannelsHandler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const probe = parseBoolean(searchParams.get("probe"));
  const timeoutMs = parseTimeoutMs(searchParams.get("timeoutMs"));

  return gwRequest("channels.status", {
    probe,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
}

const guardedLocalChannelsHandler = withAuth(localChannelsHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalChannelsHandler(request);
}
