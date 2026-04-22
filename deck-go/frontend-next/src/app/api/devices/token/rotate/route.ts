/**
 * /api/devices/token/rotate — Rotate a device token.
 *
 * POST { deviceId, role }
 *
 * Gateway contract:
 *   device.token.rotate: { deviceId, role }
 *   Returns: { deviceId, role, token, scopes, rotatedAtMs }
 */
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwCall } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDevicesRotateTokenPostHandler(request: NextRequest) {
  const { deviceId, role } = (await request.json()) as {
    deviceId: string;
    role: string;
  };
  if (!deviceId || !role) {
    return NextResponse.json({ error: "deviceId and role are required" }, { status: 400 });
  }

  try {
    const data = await gwCall("device.token.rotate", { deviceId, role });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown")) {
        return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
      }
      if (msg.includes("denied") || msg.includes("scope") || msg.includes("unauthorized")) {
        return NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const guardedLocalDevicesRotateTokenPostHandler = withAuth(localDevicesRotateTokenPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/devices/token/rotate`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDevicesRotateTokenPostHandler(request);
}
