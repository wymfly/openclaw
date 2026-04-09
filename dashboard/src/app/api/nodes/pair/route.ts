/**
 * /api/nodes/pair — Node pairing management.
 *
 * GET  — List pairing requests (node.pair.list)
 * POST — Dispatch request/approve/reject/verify by action field
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("node.pair.list", {});
});

type PairAction = "request" | "approve" | "reject" | "verify";

export const POST = withAuth(async (request: NextRequest) => {
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
});
