/**
 * POST /api/docs/extract — Extract documents from conversation history.
 *
 * Body: { sessionKey?: string }
 * Reads conversation messages, runs extractDocsFromMessages(), inserts into SQLite.
 */
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { extractDocsFromMessages } from "@/lib/doc-extractor";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { sessionKey?: string };

  try {
    // Fetch conversation messages via Gateway RPC
    let messages: Array<{ role: string; content: string }> = [];
    try {
      const params: Record<string, unknown> = {};
      if (body.sessionKey) {
        params.sessionKey = body.sessionKey;
      }
      const result = await runtime.adapter.request("chat.history", params);
      messages = result?.messages ?? [];
    } catch {
      return NextResponse.json({ error: "Failed to fetch conversation history" }, { status: 502 });
    }

    if (messages.length === 0) {
      return NextResponse.json({ extracted: 0, docs: [] });
    }

    const extractions = extractDocsFromMessages(messages);
    if (extractions.length === 0) {
      return NextResponse.json({ extracted: 0, docs: [] });
    }

    const insertStmt = runtime.db.prepare(
      `INSERT INTO docs (id, title, category, content, source_session, source_agent, keywords, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertedDocs = [];
    for (const doc of extractions) {
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      insertStmt.run(
        id,
        doc.title,
        doc.category,
        doc.content,
        body.sessionKey ?? null,
        null,
        JSON.stringify(doc.keywords),
        doc.language,
      );
      insertedDocs.push({ id, ...doc });
    }

    return NextResponse.json({ extracted: insertedDocs.length, docs: insertedDocs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
