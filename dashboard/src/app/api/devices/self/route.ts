import { loadOrCreateDeviceIdentity } from "@server/device-identity";
/**
 * /api/devices/self — Get Deck's own device identity.
 *
 * GET — Returns { deviceId } for the current Deck instance.
 *
 * Uses the local device identity (Ed25519 keypair) stored in JSON.
 * Returns { deviceId: null } on error.
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  try {
    const identity = loadOrCreateDeviceIdentity();
    return NextResponse.json({ deviceId: identity.deviceId });
  } catch {
    return NextResponse.json({ deviceId: null });
  }
});
