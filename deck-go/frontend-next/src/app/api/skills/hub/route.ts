/**
 * POST /api/skills/hub — Skills Hub operations via the Stage 2 control-plane.
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

async function validateSkillsHubPost(request: NextRequest) {
  const body = (await request.json()) as {
    action?: string;
    query?: string;
    limit?: number;
    slug?: string;
    version?: string;
  };

  switch (body.action) {
    case "search":
      return null;

    case "detail":
      if (!body.slug?.trim()) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 });
      }
      return null;

    case "install":
      if (!body.slug?.trim()) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 });
      }
      return null;

    case "update":
      return null;

    case "bins":
      return null;

    default:
      return NextResponse.json({ error: `unknown action "${body.action}"` }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const invalid = await validateSkillsHubPost(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/skills/hub`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}
