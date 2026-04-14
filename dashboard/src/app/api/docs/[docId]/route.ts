/**
 * GET  /api/docs/[docId] — Fetch a single doc by ID.
 * DELETE /api/docs/[docId] — Delete a doc by ID.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { getDocStore } from "../store";

type RouteContext = { params: Promise<{ docId: string }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { docId } = await (ctx as RouteContext).params;

  const doc = getDocStore().find((d) => d.id === docId);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
});

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { docId } = await (ctx as RouteContext).params;

  const removed = getDocStore().removeWhere((d) => d.id === docId);
  if (removed === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
