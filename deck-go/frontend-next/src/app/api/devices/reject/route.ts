/**
 * /api/devices/reject — Reject a pending pairing request.
 *
 * POST { requestId }
 *
 * Gateway contract:
 *   device.pair.reject: { requestId }
 *   Returns: { requestId, deviceId }
 */
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwCall } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDevicesRejectPostHandler(request: NextRequest) {
  const { requestId } = (await request.json()) as { requestId: string };
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  try {
    const data = await gwCall("device.pair.reject", { requestId });
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

const guardedLocalDevicesRejectPostHandler = withAuth(localDevicesRejectPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/devices/reject`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDevicesRejectPostHandler(request);
}
