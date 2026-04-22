import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2SessionRecord = {
  key?: string;
  sessionKey?: string;
  lastMessagePreview?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.clone().json()) as { keys?: string[] };

  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return Response.json({ error: "keys[] is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "GET",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { sessions?: Stage2SessionRecord[] };
    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    const keySet = new Set(body.keys);
    const previews = sessions
      .filter((session) => keySet.has(session.key ?? session.sessionKey ?? ""))
      .map((session) => {
        const key = session.key ?? session.sessionKey ?? "";
        const text = (session.lastMessagePreview ?? "").trim();
        return {
          key,
          status: text ? "ok" : "empty",
          items: text ? [{ role: "assistant", text }] : [],
        };
      });
    return NextResponse.json({
      ts: Date.now(),
      previews,
    });
  }
  return deckGoUnavailableResponse();
}
