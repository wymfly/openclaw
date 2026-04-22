/**
 * GET /api/gateway/status — Gateway status summary.
 *
 * Calls `status` RPC to retrieve session count, channels, and heartbeat info.
 */
import { type NextRequest, NextResponse } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localStatusHandler(_request: NextRequest) {
  return gatewayRequest("status", {});
}

const guardedLocalStatusHandler = withAuth(localStatusHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/gateway/status`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { status?: unknown };
    return NextResponse.json(payload.status ?? {});
  }
  return guardedLocalStatusHandler(request);
}
