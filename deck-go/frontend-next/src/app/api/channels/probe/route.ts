/**
 * /api/channels/probe — Trigger active channel probe.
 *
 * POST — Calls channels.status with probe: true
 *
 * Gateway contract:
 *   channels.status: { probe: true }
 *   Returns: same shape as GET /api/channels but with probe results per account
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localChannelProbeHandler() {
  return gwRequest("channels.status", { probe: true });
}

const guardedLocalChannelProbeHandler = withAuth(localChannelProbeHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "GET",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels?probe=true`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalChannelProbeHandler(request);
}
