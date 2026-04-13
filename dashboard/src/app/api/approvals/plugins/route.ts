/**
 * /api/approvals/plugins — Plugin approval operations.
 *
 * GET  → plugin.approval.list {}   (untyped — raw array response)
 * POST → plugin.approval.resolve { id, decision }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  // plugin.approval.list returns a raw array (untyped in codegen)
  return gatewayRequest("plugin.approval.list", {});
});

export const POST = withAuth(async (request: NextRequest) => {
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
});
