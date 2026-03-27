/**
 * /api/deck/subagents — Subagent monitoring.
 *
 * GET    — List subagent runs (deck.subagents.list)
 * POST   — Dispatch kill/lineage/steer by action field
 *
 * Gateway contracts:
 *   deck.subagents.list:    { status?, agentId?, requesterAgentId?, limit?, offset? }
 *   deck.subagents.kill:    { runId }
 *   deck.subagents.lineage: { runId?, sessionKey? }
 *   deck.subagents.steer:   { runId, instruction }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const requesterAgentId = searchParams.get("requesterAgentId");

  return gwRequest("deck.subagents.list", {
    ...(status ? { status: status as "active" | "completed" | "failed" | "timeout" | "all" } : {}),
    ...(requesterAgentId ? { requesterAgentId } : {}),
  });
});

type SubagentAction = "kill" | "lineage" | "steer";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: SubagentAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;
  const p = params as never;

  switch (action) {
    case "kill":
      return gwRequest("deck.subagents.kill", p);
    case "lineage":
      return gwRequest("deck.subagents.lineage", p);
    case "steer":
      return gwRequest("deck.subagents.steer", p);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});
