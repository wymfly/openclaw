/**
 * GET /api/skills — Fetch skill status from the Gateway.
 *
 * Gateway contract: skills.status { agentId? }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localSkillsGetHandler(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId") ?? undefined;
  return gwRequest("skills.status", agentId ? { agentId } : {});
}

const guardedLocalSkillsGetHandler = withAuth(localSkillsGetHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/skills${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalSkillsGetHandler(request);
}
