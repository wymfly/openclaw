/**
 * /api/devices/remove — Remove a paired device.
 *
 * POST { deviceId }
 *
 * Gateway contract:
 *   device.pair.remove: { deviceId }
 *   Returns: { deviceId }
 */
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwCall } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDevicesRemovePostHandler(request: NextRequest) {
  const { deviceId } = (await request.json()) as { deviceId: string };
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  try {
    const data = await gwCall("device.pair.remove", { deviceId });
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

const guardedLocalDevicesRemovePostHandler = withAuth(localDevicesRemovePostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/devices/remove`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDevicesRemovePostHandler(request);
}
