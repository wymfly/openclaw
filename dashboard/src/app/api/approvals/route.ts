/**
 * /api/approvals — Approval snapshot + resolve.
 *
 * GET  → exec.approvals.get {}  → { path, exists, hash, file }
 * POST → exec.approval.resolve { id, decision }  → { ok: true }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("exec.approvals.get", {});
});

export const POST = withAuth(async (request: NextRequest) => {
  const { id, decision } = (await request.json()) as { id: string; decision: string };
  return gwRequest("exec.approval.resolve", { id, decision });
});
