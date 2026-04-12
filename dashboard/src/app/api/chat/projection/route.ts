import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type ProjectionBody = {
  sessionKey?: string;
  a2uiState?: unknown;
};

// No-op: projection writes removed per API resilience plan.
// See: .omc/plans/deck-api-resilience.md S3a
// Frontend callers (persistChatProjection) still POST here;
// returning { ok: true } preserves compatibility.
export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as ProjectionBody | null;
  const sessionKey = body?.sessionKey?.trim();

  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
});
