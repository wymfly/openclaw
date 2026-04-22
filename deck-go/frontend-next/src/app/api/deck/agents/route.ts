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
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDeckAgentsGetHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  return gwRequest("deck.agents.detail", { agentId });
}

type AgentAction =
  | "health"
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

async function localDeckAgentsPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    action?: AgentAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;

  // Route-level params come from HTTP JSON body — assert as any for the typed call.
  // Method name typing catches typos; runtime validation happens in the Gateway.
  const p = params as never;

  switch (action) {
    case "health":
      return gwRequest("health", p);
    case "skills.get":
      return gwRequest("deck.agents.skills.get", p);
    case "skills.set":
      return gwRequest("deck.agents.skills.set", p);
    case "subagents.get":
      return gwRequest("deck.agents.subagents.get", p);
    case "subagents.set":
      return gwRequest("deck.agents.subagents.set", p);
    case "toolPolicy.preview":
      return gwRequest("deck.agents.toolPolicy.preview", p);
    case "systemPrompt.preview":
      return gwRequest("deck.agents.systemPrompt.preview", p);
    case "eventStreams.get":
      return gwRequest("deck.agents.eventStreams.get", p);
    case "eventStreams.set":
      return gwRequest("deck.agents.eventStreams.set", p);
    case "config.patch": {
      const { path, value } = params as { path?: string; value?: unknown };
      if (!path || typeof path !== "string" || path.split(".").some((s) => s === "")) {
        return Response.json({ error: "Invalid config path" }, { status: 400 });
      }
      const patch = buildMergePatch(path, value);

      // Fetch current configHash for optimistic locking
      const configRes = await gwRequest("config.get", {});
      if (configRes.status !== 200) {
        return configRes;
      }
      const configData = (await configRes.json()) as { baseHash?: string; hash?: string };
      const baseHash = configData.baseHash ?? configData.hash;

      return gwRequest("config.patch", {
        raw: JSON.stringify(patch),
        ...(baseHash ? { baseHash } : {}),
      });
    }
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

const guardedLocalDeckAgentsGetHandler = withAuth(localDeckAgentsGetHandler);
const guardedLocalDeckAgentsPostHandler = withAuth(localDeckAgentsPostHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/agents${search}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDeckAgentsGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/agents`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDeckAgentsPostHandler(request);
}
