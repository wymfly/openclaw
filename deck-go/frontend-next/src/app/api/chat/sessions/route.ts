/**
 * /api/chat/sessions — Manage chat sessions.
 *
 * GET    — List all sessions
 * DELETE — Delete a session by key
 *
 * Gateway contracts:
 *   sessions.list:   { limit?, activeMinutes?, includeGlobal?, agentId?, ... }
 *   sessions.delete: { key, deleteTranscript? }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

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
  filtered.sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
  return { sessions: filtered.slice(0, 50) };
}

async function localChatSessionsGetHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  return gwRequest("sessions.list", {
    ...(agentId ? { agentId } : {}),
    includeDerivedTitles: true,
    includeLastMessage: true,
    limit: 50,
  });
}

async function localChatSessionsDeleteHandler(request: NextRequest) {
  const body = (await request.json()) as {
    sessionKey?: string;
  };

  if (!body.sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gwRequest("sessions.delete", {
    key: body.sessionKey,
  });
}

const guardedLocalChatSessionsGetHandler = withAuth(localChatSessionsGetHandler);
const guardedLocalChatSessionsDeleteHandler = withAuth(localChatSessionsDeleteHandler);

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
  return guardedLocalChatSessionsGetHandler(request);
}

export async function DELETE(request: NextRequest) {
  return guardedLocalChatSessionsDeleteHandler(request);
}
