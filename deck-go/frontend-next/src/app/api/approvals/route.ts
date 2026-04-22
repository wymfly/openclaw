/**
 * /api/approvals — Approval snapshot + resolve.
 *
 * GET  → exec.approvals.get {}  → { path, exists, hash, file }
 * POST → exec.approval.resolve { id, decision }  → { ok: true }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localApprovalsGetHandler() {
  return gwRequest("exec.approvals.get", {});
}

async function localApprovalsPostHandler(request: NextRequest) {
  const { id, decision } = (await request.json()) as { id: string; decision: string };
  return gwRequest("exec.approval.resolve", { id, decision });
}

const guardedLocalApprovalsGetHandler = withAuth(localApprovalsGetHandler);
const guardedLocalApprovalsPostHandler = withAuth(localApprovalsPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalApprovalsGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/approvals/resolve`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalApprovalsPostHandler(request);
}
