/**
 * GET  /api/docs/[docId] — Fetch a single doc by ID.
 * DELETE /api/docs/[docId] — Delete a doc by ID.
 */
import { NextRequest, NextResponse } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";
import { getDocStore } from "../store";

type RouteContext = { params: Promise<{ docId: string }> };

async function localDocsItemGetHandler(_request: NextRequest, ctx: unknown) {
  const { docId } = await (ctx as RouteContext).params;

  const doc = getDocStore().find((d) => d.id === docId);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}

async function localDocsItemDeleteHandler(_request: NextRequest, ctx: unknown) {
  const { docId } = await (ctx as RouteContext).params;

  const removed = getDocStore().removeWhere((d) => d.id === docId);
  if (removed === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

const guardedLocalDocsItemGetHandler = withAuth(localDocsItemGetHandler);
const guardedLocalDocsItemDeleteHandler = withAuth(localDocsItemDeleteHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { docId } = await (ctx as RouteContext).params;
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/docs/${encodeURIComponent(docId)}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalDocsItemGetHandler(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { docId } = await (ctx as RouteContext).params;
  const proxied = await maybeProxyToDeckGo(request, `/api/v1/docs/${encodeURIComponent(docId)}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalDocsItemDeleteHandler(request, ctx);
}
