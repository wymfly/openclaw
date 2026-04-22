import { getPendingApprovals } from "@server/approval-bridge";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { getRuntime } from "@server/runtime";
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwCall } from "@/lib/api-helpers";
import { fetchTranscriptHistory } from "@/lib/transcript-history";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

type RawSessionMeta = Record<string, unknown>;

function listFromSessionsPayload(payload: unknown): RawSessionMeta[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is RawSessionMeta =>
      Boolean(entry && typeof entry === "object"),
    );
  }
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { sessions?: unknown[] }).sessions)
  ) {
    return (payload as { sessions: unknown[] }).sessions.filter((entry): entry is RawSessionMeta =>
      Boolean(entry && typeof entry === "object"),
    );
  }
  return [];
}

async function localChatSnapshotHandler(request: NextRequest) {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const sessionKey = searchParams.get("sessionKey");
  const agentId = searchParams.get("agentId");
  const limitStr = searchParams.get("limit");
  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const limit =
    limitStr && Number.isFinite(Number(limitStr)) ? Math.max(1, Number(limitStr)) : undefined;

  try {
    // NOTE: transcript reads still use chat.history as a narrow compatibility
    // seam. Do not replace this with sessions.preview; preview is summary data,
    // not a full transcript contract.
    const [messages, sessionsPayload] = await Promise.all([
      fetchTranscriptHistory({
        sessionKey,
        ...(limit !== undefined ? { limit } : {}),
      }),
      gwCall("sessions.list", {
        ...(agentId ? { agentId } : {}),
        includeDerivedTitles: true,
        includeLastMessage: true,
        limit: 50,
      }),
    ]);

    const meta =
      listFromSessionsPayload(sessionsPayload).find((entry) => {
        return entry.key === sessionKey || entry.sessionKey === sessionKey;
      }) ?? null;

    // Approval state from in-memory bridge — no SQLite dependency.
    // See: .omc/plans/deck-api-resilience.md S2+S5
    const pendingApproval =
      getPendingApprovals().find((approval) => approval.sessionKey === sessionKey) ?? null;

    return NextResponse.json({
      messages,
      meta,
      activeApproval: pendingApproval
        ? {
            id: pendingApproval.id,
            toolName: "command",
            command: pendingApproval.command,
            description: pendingApproval.cwd,
          }
        : null,
      // a2uiState: no longer read from SQLite projection.
      // Will be sourced from sessionStorage after Step 3b.
      a2uiState: null,
    });
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

const guardedLocalChatSnapshotHandler = withAuth(localChatSnapshotHandler);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sessionKey = searchParams.get("sessionKey");
  const agentId = searchParams.get("agentId");
  const limit = searchParams.get("limit");
  const runtimePath =
    sessionKey == null
      ? null
      : `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
          sessionKey,
        )}/timeline`;
  const proxied = runtimePath ? await fetchDeckGo(request, runtimePath) : null;
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as {
      timeline?: unknown[];
      activeRun?: unknown;
    };
    const activeApproval =
      getPendingApprovals().find((approval) => approval.sessionKey === sessionKey) ?? null;
    return NextResponse.json({
      messages: payload.timeline ?? [],
      meta: {
        key: sessionKey,
        sessionKey,
        agentId,
      },
      activeApproval: activeApproval
        ? {
            id: activeApproval.id,
            toolName: "command",
            command: activeApproval.command,
            description: activeApproval.cwd,
          }
        : null,
      a2uiState: null,
      activeRun: payload.activeRun ?? null,
    });
  }
  return guardedLocalChatSnapshotHandler(request);
}
