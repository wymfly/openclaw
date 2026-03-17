/**
 * GET /api/docs — List docs with optional category filter and search.
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

export const GET = withAuth(async (request: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  try {
    let sql = "SELECT * FROM docs";
    const conditions: string[] = [];
    const params: string[] = [];

    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }
    if (q) {
      conditions.push("(title LIKE ? OR content LIKE ? OR keywords LIKE ?)");
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY extracted_at DESC";

    const rows = runtime.db.prepare(sql).all(...params) as DocRow[];
    return NextResponse.json({ docs: rows.map(mapRow) });
  } catch {
    return NextResponse.json({ docs: [] });
  }
});
