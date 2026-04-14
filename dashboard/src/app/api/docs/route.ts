/**
 * GET /api/docs — List docs with optional category filter and search.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { getDocStore } from "./store";

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
