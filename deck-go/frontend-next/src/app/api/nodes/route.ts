/**
 * /api/nodes — Node list, describe, and rename.
 *
 * GET  — List all nodes (node.list)
 * POST — Dispatch describe/rename by action field
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localNodesGetHandler(_request: NextRequest) {
  return gwRequest("node.list", {});
}

type NodeAction = "describe" | "rename";

async function localNodesPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    action?: NodeAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;
  const p = params as never;

  switch (action) {
    case "describe":
      return gwRequest("node.describe", p);
    case "rename":
      return gwRequest("node.rename", p);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

const guardedLocalNodesGetHandler = withAuth(localNodesGetHandler);
const guardedLocalNodesPostHandler = withAuth(localNodesPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalNodesGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalNodesPostHandler(request);
}
