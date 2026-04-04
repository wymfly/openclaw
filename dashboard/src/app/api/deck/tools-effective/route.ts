/**
 * POST /api/deck/tools-effective — Stub: tools.effective has no Gateway handler.
 *
 * This method does not exist in the Gateway server-methods-list.
 * Returns empty groups until a real implementation is added upstream.
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async () => NextResponse.json({ groups: [] }));
