/**
 * /api/deck/threads — Thread listing.
 *
 * GET — List threads (deck.threads.list)
 *
 * Gateway contracts:
 *   deck.threads.list: { agentId?, channel?, limit?, status? }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDeckThreadsGetHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");
  const channel = searchParams.get("channel");
  const limit = searchParams.get("limit");
  const status = searchParams.get("status");

  return gwRequest("deck.threads.list", {
    ...(agentId ? { agentId } : {}),
    ...(channel ? { channel } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(status ? { status: status as "active" | "all" } : {}),
  });
}

const guardedLocalDeckThreadsGetHandler = withAuth(localDeckThreadsGetHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/threads${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalDeckThreadsGetHandler(request);
}
