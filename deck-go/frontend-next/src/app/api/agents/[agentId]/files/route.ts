/**
 * /api/agents/[agentId]/files — Agent file management.
 *
 * GET  — List agent files
 * POST — Write a file (body: { name, content })
 *
 * Gateway contracts:
 *   agents.files.list: { agentId }
 *   agents.files.set:  { agentId, name, content }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localAgentFilesGetHandler(_request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;

  return gwRequest("agents.files.list", {
    agentId,
  });
}

async function localAgentFilesPostHandler(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const body = (await request.json()) as {
    name?: string;
    content?: string;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  return gwRequest("agents.files.set", {
    agentId,
    name: body.name.trim(),
    content: body.content,
  });
}

const guardedLocalAgentFilesGetHandler = withAuth(localAgentFilesGetHandler);
const guardedLocalAgentFilesPostHandler = withAuth(localAgentFilesPostHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/files`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalAgentFilesGetHandler(request, ctx);
}

export async function POST(request: NextRequest, ctx: unknown) {
  const { agentId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/files`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalAgentFilesPostHandler(request, ctx);
}
