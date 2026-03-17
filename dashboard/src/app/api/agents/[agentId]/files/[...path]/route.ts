/**
 * /api/agents/[agentId]/files/[...path] — Read a single agent file.
 *
 * GET — Read file content by path
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ agentId: string; path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { agentId, path } = await context.params;
  const filePath = path.join("/");
  const platform = extractPlatformHeaders(request);

  return gatewayRequest("agents.files.get", {
    agentId,
    path: filePath,
    ...platform,
  });
}
