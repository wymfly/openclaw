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
import { gwCall } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
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
});
