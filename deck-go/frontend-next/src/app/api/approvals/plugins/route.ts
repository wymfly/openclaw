/**
 * /api/approvals/plugins — Plugin approval operations.
 *
 * GET  → plugin.approval.list {}   (untyped — raw array response)
 * POST → plugin.approval.resolve { id, decision }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest, gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localApprovalsPluginsGetHandler() {
  // plugin.approval.list returns a raw array (untyped in codegen)
  return gatewayRequest("plugin.approval.list", {});
}

async function localApprovalsPluginsPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    id?: string;
    decision?: string;
  };

  if (!body.id?.trim()) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  if (!body.decision?.trim()) {
    return Response.json({ error: "decision is required" }, { status: 400 });
  }

  return gwRequest("plugin.approval.resolve", {
    id: body.id,
    decision: body.decision,
  });
}

const guardedLocalApprovalsPluginsGetHandler = withAuth(localApprovalsPluginsGetHandler);
const guardedLocalApprovalsPluginsPostHandler = withAuth(localApprovalsPluginsPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/plugins`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalApprovalsPluginsGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/plugins/resolve`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalApprovalsPluginsPostHandler(request);
}
