/**
 * /api/agents/[agentId]/files/[...path] — Read a single agent file.
 *
 * GET — Read file content by name (path segments joined)
 *
 * Gateway contract (`AgentsFilesGetParamsSchema`):
 *   { agentId, name }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string; path: string[] }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { agentId, path } = await (ctx as RouteContext).params;
  const name = path.join("/");

  return gatewayRequest("agents.files.get", {
    agentId,
    name,
  });
});
