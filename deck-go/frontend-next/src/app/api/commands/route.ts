/**
 * GET /api/commands — Full command catalog with typed argument schemas.
 *
 * Gateway: commands.list → { commands[{ name, source, category, scope, args }] }
 *
 * Complements deck.commands.discover (lightweight) with richer arg schemas,
 * scopes, and text aliases for enhanced command palette UX.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localCommandsGetHandler(_request: NextRequest) {
  return gatewayRequest("commands.list", {});
}

const guardedLocalCommandsGetHandler = withAuth(localCommandsGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/commands`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalCommandsGetHandler(request);
}
