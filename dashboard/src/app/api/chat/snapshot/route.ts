import { getPendingApprovals } from "@server/approval-bridge";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { getRuntime } from "@server/runtime";
import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

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

export const GET = withAuth(async (request: NextRequest) => {
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
    const [historyPayload, sessionsPayload] = await Promise.all([
      runtime.adapter.request("chat.history", {
        sessionKey,
        ...(limit !== undefined ? { limit } : {}),
      }),
      runtime.adapter.request("sessions.list", {
        ...(agentId ? { agentId } : {}),
        includeDerivedTitles: true,
        includeLastMessage: true,
        limit: 50,
      }),
    ]);

    const messages = Array.isArray((historyPayload as { messages?: unknown[] }).messages)
      ? ((historyPayload as { messages: unknown[] }).messages as Array<{
          role?: string;
          content?: unknown;
          timestamp?: number;
        }>)
      : [];

    const meta =
      listFromSessionsPayload(sessionsPayload).find((entry) => {
        return entry.key === sessionKey || entry.sessionKey === sessionKey;
      }) ?? null;

    const pendingApproval =
      getPendingApprovals().find((approval) => approval.sessionKey === sessionKey) ?? null;
    const projection = runtime.store.getChatSessionProjection(sessionKey);
    const projectedApproval =
      projection?.activeApproval &&
      typeof projection.activeApproval === "object" &&
      typeof projection.activeApproval.id === "string"
        ? projection.activeApproval
        : null;

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
        : projectedApproval,
      a2uiState: projection?.a2uiState ?? null,
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
});
