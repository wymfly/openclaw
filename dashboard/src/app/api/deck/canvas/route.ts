import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest): Promise<Response> => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "runtime not initialized" }, { status: 503 });
  }

  const nodeConn = runtime.adapter.getNodeConnection();
  if (!nodeConn) {
    return NextResponse.json({ error: "node connection unavailable" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { action, sessionKey } = body as { action?: string; sessionKey?: string };

  // Canvas ready/unready lifecycle
  if (action === "ready") {
    if (typeof sessionKey !== "string" || !sessionKey.trim()) {
      return NextResponse.json({ error: "sessionKey required" }, { status: 400 });
    }
    nodeConn.markCanvasSessionReady(sessionKey);
    return NextResponse.json({ ok: true });
  }
  if (action === "unready") {
    if (typeof sessionKey !== "string" || !sessionKey.trim()) {
      return NextResponse.json({ error: "sessionKey required" }, { status: 400 });
    }
    nodeConn.markCanvasSessionUnready(sessionKey);
    return NextResponse.json({ ok: true });
  }

  // Eval result callback
  const { evalId, result } = body as { evalId?: string; result?: unknown };
  if (typeof evalId !== "string" || !evalId) {
    return NextResponse.json({ error: "evalId required" }, { status: 400 });
  }

  const resolved = nodeConn.resolveEval(evalId, result);
  if (!resolved) {
    return NextResponse.json({ error: "evalId not found or already consumed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
