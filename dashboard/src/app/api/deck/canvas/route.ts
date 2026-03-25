import { getRuntime } from "@server/runtime";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
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

  const { action } = body as { action?: string };

  // Canvas session register/unregister
  if (action === "register") {
    nodeConn.registerCanvasSession();
    return NextResponse.json({ ok: true });
  }
  if (action === "unregister") {
    nodeConn.unregisterCanvasSession();
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
}
