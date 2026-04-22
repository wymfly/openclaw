/**
 * /api/agents/[agentId] — Single agent operations.
 *
 * GET   — Get agent details (uses agents.list then filters)
 * PATCH — Update agent configuration
 *
 * Gateway contracts:
 *   agents.list:   {} (no params, returns all agents)
 *   agents.update: { agentId, name?, workspace?, model?, avatar? }
 */
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localAgentGetHandler(_request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  // agents.list takes no params; filter client-side
  const res = await gwRequest("agents.list", {});
  if (res.status !== 200) {
    return res;
  }
  const data = (await res.json()) as {
    agents?: Array<{ id: string }>;
  };
  const agent = data.agents?.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

async function localAgentPatchHandler(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const body = (await request.json()) as {
    name?: string;
    workspace?: string;
    model?: string;
    avatar?: string;
  };

  return gwRequest("agents.update", {
    agentId,
    ...(body.name ? { name: body.name } : {}),
    ...(body.workspace ? { workspace: body.workspace } : {}),
    ...(body.model ? { model: body.model } : {}),
    ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
  });
}

const guardedLocalAgentGetHandler = withAuth(localAgentGetHandler);
const guardedLocalAgentPatchHandler = withAuth(localAgentPatchHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(agentId)}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalAgentGetHandler(request, ctx);
}

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(agentId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalAgentPatchHandler(request, ctx);
}
