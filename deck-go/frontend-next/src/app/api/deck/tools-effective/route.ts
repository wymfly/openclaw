/**
 * POST /api/deck/tools-effective — Get effective tools after policy filtering.
 *
 * Gateway contract:
 *   Params: { agentId?, sessionKey? }
 *   Returns: { groups[{ name, tools[{ id, name, allowed, source }] }] }
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDeckToolsEffectiveHandler(request: NextRequest) {
  const body = (await request.json()) as {
    agentId?: string;
    sessionKey?: string;
  };
  return gatewayRequest("tools.effective", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.sessionKey ? { sessionKey: body.sessionKey } : {}),
  });
}

const guardedLocalDeckToolsEffectiveHandler = withAuth(localDeckToolsEffectiveHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/tools-effective`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalDeckToolsEffectiveHandler(request);
}
