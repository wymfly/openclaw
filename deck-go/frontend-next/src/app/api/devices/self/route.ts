import { loadOrCreateDeviceIdentity } from "@server/device-identity";
/**
 * /api/devices/self — Get Deck's own device identity.
 *
 * GET — Returns { deviceId } for the current Deck instance.
 *
 * Uses the local device identity (Ed25519 keypair) stored in JSON.
 * Returns { deviceId: null } on error.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDevicesSelfGetHandler(_request: NextRequest) {
  try {
    const identity = loadOrCreateDeviceIdentity();
    return NextResponse.json({ deviceId: identity.deviceId });
  } catch {
    return NextResponse.json({ deviceId: null });
  }
}

const guardedLocalDevicesSelfGetHandler = withAuth(localDevicesSelfGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/devices/self`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { deviceId?: string | null };
    return NextResponse.json({ deviceId: payload.deviceId ?? null });
  }
  return guardedLocalDevicesSelfGetHandler(request);
}
