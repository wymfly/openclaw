/**
 * POST /api/skills/hub — Skills Hub operations (search + detail).
 *
 * Actions:
 *   { action: "search", query?, limit? }  → skills.search
 *   { action: "detail", slug }            → skills.detail
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: string;
    query?: string;
    limit?: number;
    slug?: string;
  };

  switch (body.action) {
    case "search":
      return gwRequest("skills.search", {
        ...(body.query ? { query: body.query } : {}),
        ...(body.limit ? { limit: body.limit } : {}),
      });

    case "detail":
      if (!body.slug?.trim()) {
        return Response.json({ error: "slug is required" }, { status: 400 });
      }
      return gwRequest("skills.detail", { slug: body.slug });

    default:
      return Response.json({ error: `unknown action "${body.action}"` }, { status: 400 });
  }
});
