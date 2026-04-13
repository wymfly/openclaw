/**
 * POST /api/chat/compaction — Compaction checkpoint operations.
 *
 * Actions:
 *   { action: "list", key }        → sessions.compaction.list
 *   { action: "branch", key, checkpointId }   → sessions.compaction.branch
 *   { action: "restore", key, checkpointId }  → sessions.compaction.restore
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: string;
    key?: string;
    checkpointId?: string;
  };

  if (!body.key?.trim()) {
    return Response.json({ error: "key is required" }, { status: 400 });
  }

  switch (body.action) {
    case "list":
      return gwRequest("sessions.compaction.list", { key: body.key });

    case "branch":
      if (!body.checkpointId?.trim()) {
        return Response.json({ error: "checkpointId is required" }, { status: 400 });
      }
      return gwRequest("sessions.compaction.branch", {
        key: body.key,
        checkpointId: body.checkpointId,
      });

    case "restore":
      if (!body.checkpointId?.trim()) {
        return Response.json({ error: "checkpointId is required" }, { status: 400 });
      }
      return gwRequest("sessions.compaction.restore", {
        key: body.key,
        checkpointId: body.checkpointId,
      });

    default:
      return Response.json({ error: `unknown action "${body.action}"` }, { status: 400 });
  }
});
