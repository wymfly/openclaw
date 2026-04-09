/**
 * /api/nodes — Node list, describe, and rename.
 *
 * GET  — List all nodes (node.list)
 * POST — Dispatch describe/rename by action field
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("node.list", {});
});

type NodeAction = "describe" | "rename";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: NodeAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;
  const p = params as never;

  switch (action) {
    case "describe":
      return gwRequest("node.describe", p);
    case "rename":
      return gwRequest("node.rename", p);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});
