/**
 * GET /api/channels/[channelId]/throughput — Channel throughput summary.
 *
 * Phase 0 fallback:
 * We do not yet have an authoritative historical throughput source wired into
 * Deck/Gateway. Return an empty, explicit dataset so the UI has a stable route
 * surface without inventing traffic history.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest, _ctx: unknown) => {
  return NextResponse.json({
    buckets: [],
    messagesIn: 0,
    messagesOut: 0,
  });
});
