/**
 * GET /api/memory/search — Vector search over memory.
 *
 * Query params:
 *   - q (required): search query
 *   - agentId (optional): scope search to an agent
 *
 * Currently returns 501 — requires LanceDB extension to be available.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q");

  if (!q?.trim()) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  return NextResponse.json(
    { error: "Not implemented — requires LanceDB extension" },
    { status: 501 },
  );
});
