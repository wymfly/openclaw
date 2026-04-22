/**
 * GET /api/gateway/health — Gateway health check.
 *
 * Calls `health` RPC to retrieve health details (sessions, channels, auth).
 */
import { type NextRequest, NextResponse } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localHealthHandler(_request: NextRequest) {
  return gatewayRequest("health", {});
}

const guardedLocalHealthHandler = withAuth(localHealthHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/gateway/health`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { health?: unknown };
    return NextResponse.json(payload.health ?? {});
  }
  return guardedLocalHealthHandler(request);
}
