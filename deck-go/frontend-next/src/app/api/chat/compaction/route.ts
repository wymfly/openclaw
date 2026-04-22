/**
 * POST /api/chat/compaction — Compaction checkpoint operations.
 *
 * Actions:
 *   { action: "list", key }        → sessions.compaction.list
 *   { action: "branch", key, checkpointId }   → sessions.compaction.branch
 *   { action: "restore", key, checkpointId }  → sessions.compaction.restore
 */
import { NextRequest } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

async function localChatCompactionPostHandler(request: NextRequest) {
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
}

const guardedLocalChatCompactionPostHandler = withAuth(localChatCompactionPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/chat/compaction");
  if (proxied) {
    return proxied;
  }
  return guardedLocalChatCompactionPostHandler(request);
}
