/**
 * /api/approvals/policy — Read and update approval policy.
 *
 * GET → exec.approvals.get {} → { path, exists, hash, file: ExecApprovalsFile }
 * PUT → exec.approvals.set { file, baseHash } → updated snapshot
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localApprovalsPolicyGetHandler() {
  return gwRequest("exec.approvals.get", {});
}

async function localApprovalsPolicyPutHandler(request: NextRequest) {
  const body = (await request.json()) as { file: unknown; baseHash?: string };
  return gwRequest("exec.approvals.set", {
    file: body.file,
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
  } as GatewayMethodMap["exec.approvals.set"]["params"]);
}

const guardedLocalApprovalsPolicyGetHandler = withAuth(localApprovalsPolicyGetHandler);
const guardedLocalApprovalsPolicyPutHandler = withAuth(localApprovalsPolicyPutHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/policy`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalApprovalsPolicyGetHandler(request);
}

export async function PUT(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/policy`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalApprovalsPolicyPutHandler(request);
}
