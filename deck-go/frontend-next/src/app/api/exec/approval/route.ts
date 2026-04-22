import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

/**
 * POST /api/exec/approval
 *
 * Relay a tool-execution approval decision to the Gateway.
 * Body: { id: string; decision: "allow-once" | "allow-always" | "deny" }
 */
async function localExecApprovalPostHandler(request: NextRequest) {
  const body = (await request.json()) as { id: string; decision: string };
  return gatewayRequest("exec.approval.resolve", {
    id: body.id,
    decision: body.decision,
  });
}

const guardedLocalExecApprovalPostHandler = withAuth(localExecApprovalPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/resolve`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalExecApprovalPostHandler(request);
}
