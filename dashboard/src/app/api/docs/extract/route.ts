/**
 * POST /api/docs/extract — Extract documents from conversation history.
 *
 * Body: { sessionKey?: string }
 * Reads conversation messages, runs extractDocsFromMessages(), inserts into JSON store.
 */
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { extractDocsFromMessages } from "@/lib/doc-extractor";
import { fetchTranscriptHistory } from "@/lib/transcript-history";
import { withAuth } from "@/lib/with-auth";
import { getDocStore, type DocEntry } from "../route";

export const POST = withAuth(async (request: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { sessionKey?: string };

  try {
    let messages: Array<{ role: string; content: unknown }> = [];
    try {
      if (!body.sessionKey) {
        return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
      }
      messages = await fetchTranscriptHistory({ sessionKey: body.sessionKey });
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

    const store = getDocStore();
    const now = new Date().toISOString();
    const insertedDocs: DocEntry[] = [];

    for (const doc of extractions) {
      const entry: DocEntry = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: doc.title,
        category: doc.category,
        content: doc.content,
        sourceSession: body.sessionKey ?? null,
        sourceAgent: null,
        keywords: doc.keywords,
        language: doc.language,
        extractedAt: now,
        updatedAt: now,
      };
      store.append(entry);
      insertedDocs.push(entry);
    }

    return NextResponse.json({ extracted: insertedDocs.length, docs: insertedDocs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
