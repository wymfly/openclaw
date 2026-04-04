import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type ProjectionBody = {
  sessionKey?: string;
  a2uiState?: unknown;
};

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as ProjectionBody | null;
  const sessionKey = body?.sessionKey?.trim();

  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }
  const store = runtime.store;
  if (!body || !("a2uiState" in body)) {
    return NextResponse.json({ error: "a2uiState is required" }, { status: 400 });
  }

  store.getApprovalProjectionWithMigration(sessionKey);

  if (body.a2uiState == null) {
    store.clearProjection("chat", sessionKey);
  } else {
    store.setProjection("chat", sessionKey, {
      a2uiState: body.a2uiState,
    });
  }

  return NextResponse.json({ ok: true });
});
