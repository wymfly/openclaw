/**
 * /api/deck/agents — Agent detail, skills, and subagent config.
 *
 * GET    — Get agent detail (deck.agents.detail)
 * POST   — Dispatch skills.get/set, subagents.get/set by action field
 *
 * Gateway contracts:
 *   deck.agents.detail:                { agentId }
 *   deck.agents.skills.get:            { agentId }
 *   deck.agents.skills.set:            { agentId, mode, skills, baseHash }
 *   deck.agents.subagents.get:         { agentId }
 *   deck.agents.subagents.set:         { agentId, allowAgents, model?, baseHash }
 *   deck.agents.toolPolicy.preview:    { agentId }
 *   deck.agents.systemPrompt.preview:  { agentId }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  return gatewayRequest("deck.agents.detail", { agentId });
});

type AgentAction =
  | "skills.get"
  | "skills.set"
  | "subagents.get"
  | "subagents.set"
  | "toolPolicy.preview"
  | "systemPrompt.preview";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: AgentAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;

  switch (action) {
    case "skills.get":
      return gatewayRequest("deck.agents.skills.get", params);
    case "skills.set":
      return gatewayRequest("deck.agents.skills.set", params);
    case "subagents.get":
      return gatewayRequest("deck.agents.subagents.get", params);
    case "subagents.set":
      return gatewayRequest("deck.agents.subagents.set", params);
    case "toolPolicy.preview":
      return gatewayRequest("deck.agents.toolPolicy.preview", params);
    case "systemPrompt.preview":
      return gatewayRequest("deck.agents.systemPrompt.preview", params);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});
