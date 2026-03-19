/**
 * /api/deck/subagents — Subagent monitoring.
 *
 * GET    — List subagent runs (deck.subagents.list)
 * POST   — Dispatch kill/lineage by action field
 *
 * Gateway contracts:
 *   deck.subagents.list:    { status?, agentId?, requesterAgentId?, limit?, offset? }
 *   deck.subagents.kill:    { runId }
 *   deck.subagents.lineage: { runId?, sessionKey? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const requesterAgentId = searchParams.get("requesterAgentId");

  return gatewayRequest("deck.subagents.list", {
    ...(status ? { status } : {}),
    ...(requesterAgentId ? { requesterAgentId } : {}),
  });
});

type SubagentAction = "kill" | "lineage";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: SubagentAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;

  switch (action) {
    case "kill":
      return gatewayRequest("deck.subagents.kill", params);
    case "lineage":
      return gatewayRequest("deck.subagents.lineage", params);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});
