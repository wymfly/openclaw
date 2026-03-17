/**
 * /api/approvals — Approval snapshot + resolve.
 *
 * GET  → exec.approvals.get {}  → { path, exists, hash, file }
 * POST → exec.approval.resolve { id, decision }  → { ok: true }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gatewayRequest("exec.approvals.get", {});
});

export const POST = withAuth(async (request: NextRequest) => {
  const { id, decision } = (await request.json()) as { id: string; decision: string };
  return gatewayRequest("exec.approval.resolve", { id, decision });
});
