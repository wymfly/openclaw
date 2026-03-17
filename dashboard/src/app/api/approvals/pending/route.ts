import { getPendingApprovals } from "@server/approval-bridge";
import { NextResponse } from "next/server";
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

export const GET = withAuth(async () => {
  const pending = getPendingApprovals();
  return NextResponse.json({ pending });
});
