import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2SessionRecord = {
  key?: string;
  sessionKey?: string;
  agentId?: string;
  title?: string;
  lastMessagePreview?: string;
  updatedAt?: number;
  status?: string;
};

function filterChatSessions(items: Stage2SessionRecord[], request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  let filtered = [...items];
  if (agentId) {
    filtered = filtered.filter((session) => session.agentId === agentId);
  }
  filtered.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { sessions: filtered.slice(0, 50) };
}

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { sessions?: Stage2SessionRecord[] };
    return NextResponse.json(filterChatSessions(payload.sessions ?? [], request));
  }
  return deckGoUnavailableResponse();
}

export async function DELETE(request: NextRequest) {
  const body = (await request.clone().json()) as { sessionKey?: string };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "DELETE",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      body.sessionKey,
    )}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: body.sessionKey });
  }
  return deckGoUnavailableResponse();
}
