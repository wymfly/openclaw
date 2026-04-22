/**
 * /api/devices — Device management.
 *
 * GET — List all paired devices and pending pairing requests
 *
 * Gateway contract:
 *   device.pair.list: {}
 *   Returns: { pending[], approved[] }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDevicesGetHandler(_request: NextRequest) {
  return gwRequest("device.pair.list", {});
}

const guardedLocalDevicesGetHandler = withAuth(localDevicesGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/devices`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { devices?: unknown };
    return NextResponse.json(payload.devices ?? {});
  }
  return guardedLocalDevicesGetHandler(request);
}
