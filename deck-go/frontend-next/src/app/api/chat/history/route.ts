import { type NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sessionKey = searchParams.get("sessionKey");
  const limitStr = searchParams.get("limit");

  if (!sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      sessionKey,
    )}/timeline`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { timeline?: unknown[] };
    const limit = limitStr ? Number(limitStr) : undefined;
    const messages = Array.isArray(payload.timeline) ? payload.timeline : [];
    const trimmed =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? messages.slice(-limit)
        : messages;
    return NextResponse.json({ messages: trimmed });
  }
  return deckGoUnavailableResponse();
}
