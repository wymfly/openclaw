/**
 * /api/agents/[agentId]/files/[...path] — Read a single agent file.
 *
 * GET — Read file content by name (path segments joined)
 *
 * Gateway contract (`AgentsFilesGetParamsSchema`):
 *   { agentId, name }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string; path: string[] }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localAgentFileGetHandler(_request: NextRequest, ctx: unknown) {
  const { agentId, path } = await (ctx as RouteContext).params;
  const name = path.join("/");

  return gwRequest("agents.files.get", {
    agentId,
    name,
  });
}

const guardedLocalAgentFileGetHandler = withAuth(localAgentFileGetHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { agentId, path } = await (ctx as RouteContext).params;
  const filePath = path.map((part) => encodeURIComponent(part)).join("/");
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(
      agentId,
    )}/files/${filePath}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalAgentFileGetHandler(request, ctx);
}
