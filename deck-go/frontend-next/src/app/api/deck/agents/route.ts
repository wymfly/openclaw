/**
 * /api/deck/agents — Agent detail, skills, subagent config, and event streams.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

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
async function validateDeckAgentsPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    action?: AgentAction;
    [key: string]: unknown;
  };

  switch (body.action) {
    case "health":
    case "skills.get":
    case "skills.set":
    case "subagents.get":
    case "subagents.set":
    case "toolPolicy.preview":
    case "systemPrompt.preview":
    case "eventStreams.get":
    case "eventStreams.set":
      return null;
    case "config.patch": {
      const { path } = body as { path?: string };
      if (!path || typeof path !== "string" || path.split(".").some((s) => s === "")) {
        return NextResponse.json({ error: "Invalid config path" }, { status: 400 });
      }
      return null;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  if (!request.nextUrl.searchParams.get("agentId")) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/agents${search}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

export async function POST(request: NextRequest) {
  const invalid = await validateDeckAgentsPostHandler(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/agents`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
