/**
 * GET /api/agents/[agentId]/identity — Get agent identity.
 *
 * Gateway contract: agent.identity.get { agentId }
 * Returns: { agentId, name?, avatar?, emoji? }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localAgentIdentityGetHandler(_request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  return gwRequest("agent.identity.get", { agentId });
}

const guardedLocalAgentIdentityGetHandler = withAuth(localAgentIdentityGetHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/identity`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalAgentIdentityGetHandler(request, ctx);
}
