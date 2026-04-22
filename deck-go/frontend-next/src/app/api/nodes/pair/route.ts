/**
 * /api/nodes/pair — Node pairing management.
 *
 * GET  — List pairing requests (node.pair.list)
 * POST — Dispatch request/approve/reject/verify by action field
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localNodesPairGetHandler(_request: NextRequest) {
  return gwRequest("node.pair.list", {});
}

type PairAction = "request" | "approve" | "reject" | "verify";

async function localNodesPairPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    action?: PairAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;
  const p = params as never;

  switch (action) {
    case "request":
      return gwRequest("node.pair.request", p);
    case "approve":
      return gwRequest("node.pair.approve", p);
    case "reject":
      return gwRequest("node.pair.reject", p);
    case "verify":
      return gwRequest("node.pair.verify", p);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

const guardedLocalNodesPairGetHandler = withAuth(localNodesPairGetHandler);
const guardedLocalNodesPairPostHandler = withAuth(localNodesPairPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes/pair`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalNodesPairGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes/pair`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalNodesPairPostHandler(request);
}
