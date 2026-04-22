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
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDeckSubagentsGetHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const requesterAgentId = searchParams.get("requesterAgentId");

  return gwRequest("deck.subagents.list", {
    ...(status ? { status: status as "active" | "completed" | "failed" | "timeout" | "all" } : {}),
    ...(requesterAgentId ? { requesterAgentId } : {}),
  });
}

type SubagentAction = "kill" | "lineage" | "steer";

async function localDeckSubagentsPostHandler(request: NextRequest) {
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
}

const guardedLocalDeckSubagentsGetHandler = withAuth(localDeckSubagentsGetHandler);
const guardedLocalDeckSubagentsPostHandler = withAuth(localDeckSubagentsPostHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/subagents${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalDeckSubagentsGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/subagents`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDeckSubagentsPostHandler(request);
}
