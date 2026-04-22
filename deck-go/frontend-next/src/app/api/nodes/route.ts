/**
 * /api/nodes — Node list, describe, and rename.
 *
 * GET  — List all nodes
 * POST — Dispatch describe/rename by action field
 */
import { NextResponse, type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type NodeAction = "describe" | "rename";
async function validateNodesPost(request: NextRequest) {
  const body = (await request.json()) as {
    action?: NodeAction;
    [key: string]: unknown;
  };
  switch (body.action) {
    case "describe":
    case "rename":
      return null;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

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
  return deckGoUnavailableResponse();
}

export async function POST(request: NextRequest) {
  const invalid = await validateNodesPost(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
