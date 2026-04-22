import { getPendingApprovals } from "@server/approval-bridge";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
/**
 * /api/approvals/pending — Return current pending approvals from in-memory map.
 *
 * GET → returns { pending: PendingApproval[] }
 *
 * This endpoint enables refresh recovery: the client calls it on mount to
 * get the current set of pending approvals that arrived via Gateway WS
 * events. SSE then keeps the list up-to-date in real time.
 */
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localApprovalsPendingGetHandler(_request: NextRequest) {
  const pending = getPendingApprovals();
  return NextResponse.json({ pending });
}

const guardedLocalApprovalsPendingGetHandler = withAuth(localApprovalsPendingGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/pending`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalApprovalsPendingGetHandler(request);
}
