/**
 * GET /api/settings/version — Return version info for deck, gateway, and CLI.
 *
 * - deck: from package.json
 * - gateway/cli: from adapter status (if connected); else "unknown"
 */
import { NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { getRuntime } from "@server/runtime";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
// Read deck version at module load time (static)
import packageJson from "../../../../../package.json" with { type: "json" };

async function localSettingsVersionHandler() {
  const deckVersion = packageJson.version ?? "unknown";

  const runtime = getRuntime();
  let gatewayVersion = "unknown";
  let cliVersion = "unknown";

  if (runtime) {
    const status = runtime.adapter.getStatus();
    if (status === "connected") {
      // Gateway version is not directly available from the adapter status response.
      // The connect handshake response may contain server info, but it's not exposed.
      // For now, we report the connection status as a proxy.
      gatewayVersion = "connected";
      cliVersion = "connected";
    }
  }

  return NextResponse.json({
    deck: deckVersion,
    gateway: gatewayVersion,
    cli: cliVersion,
  });
}

const guardedLocalSettingsVersionHandler = withAuth(localSettingsVersionHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/settings/version");
  if (proxied) {
    return proxied;
  }
  return guardedLocalSettingsVersionHandler(request);
}
