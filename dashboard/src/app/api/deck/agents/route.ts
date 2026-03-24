/**
 * /api/deck/agents — Agent detail, skills, subagent config, and event streams.
 *
 * GET    — Get agent detail (deck.agents.detail)
 * POST   — Dispatch skills.get/set, subagents.get/set, eventStreams.get/set by action field
 *
 * Gateway contracts:
 *   deck.agents.detail:                { agentId }
 *   deck.agents.skills.get:            { agentId }
 *   deck.agents.skills.set:            { agentId, mode, skills, baseHash }
 *   deck.agents.subagents.get:         { agentId }
 *   deck.agents.subagents.set:         { agentId, allowAgents, model?, baseHash }
 *   deck.agents.toolPolicy.preview:    { agentId }
 *   deck.agents.systemPrompt.preview:  { agentId }
 *   deck.agents.eventStreams.get:       { agentId }
 *   deck.agents.eventStreams.set:       { agentId, eventStreams, baseHash }
 *   config.patch:                      { raw, baseHash } (merge-patch JSON string)
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
  | "systemPrompt.preview"
  | "eventStreams.get"
  | "eventStreams.set"
  | "config.patch";

/**
 * Build a nested merge-patch object from a dotted config path and value.
 * e.g. ("agents.defaults.thinkingDefault", "low") => { agents: { defaults: { thinkingDefault: "low" } } }
 */
function buildMergePatch(path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  let obj: Record<string, unknown> = {};
  const root = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const child: Record<string, unknown> = {};
    obj[keys[i]] = child;
    obj = child;
  }
  obj[keys[keys.length - 1]] = value;
  return root;
}

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
    case "eventStreams.get":
      return gatewayRequest("deck.agents.eventStreams.get", params);
    case "eventStreams.set":
      return gatewayRequest("deck.agents.eventStreams.set", params);
    case "config.patch": {
      const { path, value } = params as { path?: string; value?: unknown };
      if (!path || typeof path !== "string" || path.split(".").some((s) => s === "")) {
        return Response.json({ error: "Invalid config path" }, { status: 400 });
      }
      const patch = buildMergePatch(path, value);

      // Fetch current configHash for optimistic locking
      const configRes = await gatewayRequest("config.get", {});
      if (configRes.status !== 200) {
        return configRes;
      }
      const configData = (await configRes.json()) as { baseHash?: string };
      const baseHash = configData.baseHash;

      return gatewayRequest("config.patch", {
        raw: JSON.stringify(patch),
        ...(baseHash ? { baseHash } : {}),
      });
    }
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});
