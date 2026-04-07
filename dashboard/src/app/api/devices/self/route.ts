import { loadOrCreateDeviceIdentity } from "@server/device-identity";
import { getRuntime } from "@server/runtime";
/**
 * /api/devices/self — Get Deck's own device identity.
 *
 * GET — Returns { deviceId } for the current Deck instance.
 *
 * Uses the local device identity (Ed25519 keypair) stored in SQLite.
 * Returns { deviceId: null } when the runtime or DB is unavailable.
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime?.db) {
    return NextResponse.json({ deviceId: null });
  }
  try {
    const identity = loadOrCreateDeviceIdentity(runtime.db);
    return NextResponse.json({ deviceId: identity.deviceId });
  } catch {
    return NextResponse.json({ deviceId: null });
  }
});
