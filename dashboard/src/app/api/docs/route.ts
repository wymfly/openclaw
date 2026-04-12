/**
 * GET /api/docs — List docs with optional category filter and search.
 */
import { getJsonStore } from "@server/json-store";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export interface DocEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  sourceSession: string | null;
  sourceAgent: string | null;
  keywords: string[];
  language: string;
  extractedAt: string;
  updatedAt: string;
}

export function getDocStore() {
  return getJsonStore<DocEntry[]>("docs", []);
}

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.toLowerCase();

  let docs = [...getDocStore().get()];

  if (category) {
    docs = docs.filter((d) => d.category === category);
  }
  if (q) {
    docs = docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        d.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }

  docs.sort((a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime());
  return NextResponse.json({ docs });
});
