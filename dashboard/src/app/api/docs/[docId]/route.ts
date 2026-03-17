/**
 * GET  /api/docs/[docId] — Fetch a single doc by ID.
 * DELETE /api/docs/[docId] — Delete a doc by ID.
 */
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type DocRow = {
  id: string;
  title: string;
  category: string;
  content: string;
  source_session: string | null;
  source_agent: string | null;
  keywords: string;
  language: string;
  extracted_at: string;
  updated_at: string;
};

function mapRow(row: DocRow) {
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(row.keywords);
  } catch {
    /* ignore malformed JSON */
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    sourceSession: row.source_session,
    sourceAgent: row.source_agent,
    keywords,
    language: row.language,
    extractedAt: row.extracted_at,
    updatedAt: row.updated_at,
  };
}

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { docId } = (ctx as { params: Promise<{ docId: string }> }).params
    ? await (ctx as { params: Promise<{ docId: string }> }).params
    : { docId: "" };

  try {
    const row = runtime.db.prepare("SELECT * FROM docs WHERE id = ?").get(docId) as
      | DocRow
      | undefined;

    if (!row) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(mapRow(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { docId } = (ctx as { params: Promise<{ docId: string }> }).params
    ? await (ctx as { params: Promise<{ docId: string }> }).params
    : { docId: "" };

  try {
    const result = runtime.db.prepare("DELETE FROM docs WHERE id = ?").run(docId);
    if (result.changes === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
