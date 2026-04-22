/**
 * /api/chat/sessions/preview — Lightweight session previews for sidebar.
 *
 * POST — Fetch preview summaries for a batch of session keys.
 *
 * Gateway contract:
 *   sessions.preview: { keys: string[] } → { ts, previews: [{ key, status, items }] }
 *
 * This is a lighter alternative to sessions.list for refreshing sidebar previews
 * without re-fetching full session metadata. See transcript-history.ts for the
 * full transcript seam (chat.history) — do not conflate the two.
 */
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2SessionRecord = {
  key?: string;
  sessionKey?: string;
  lastMessagePreview?: string;
};

async function localChatSessionsPreviewPostHandler(request: NextRequest) {
  const body = (await request.json()) as { keys?: string[] };

  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return Response.json({ error: "keys[] is required" }, { status: 400 });
  }

  return gwRequest("sessions.preview", { keys: body.keys });
}

const guardedLocalChatSessionsPreviewPostHandler = withAuth(localChatSessionsPreviewPostHandler);

export async function POST(request: NextRequest) {
  const body = (await request.clone().json()) as { keys?: string[] };

  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return Response.json({ error: "keys[] is required" }, { status: 400 });
  }

  const proxied = await fetchDeckGo(
    request,
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
      .filter((session) => keySet.has(String(session.key ?? session.sessionKey ?? "")))
      .map((session) => {
        const key = String(session.key ?? session.sessionKey ?? "");
        const text = String(session.lastMessagePreview ?? "").trim();
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
  return guardedLocalChatSessionsPreviewPostHandler(request);
}
