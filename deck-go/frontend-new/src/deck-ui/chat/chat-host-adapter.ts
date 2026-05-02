import type {
  DeckGoChatHistoryResponse,
  DeckGoChatSnapshotResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { normalizeHistoryMessages } from "../../components/panels/chat/history-normalize";
import type { ApprovalRequest, SessionMeta, SessionPreviewOverlay } from "../../stores/chat-types";

type ChatStoreSelectionAPI = {
  setActiveSession: (key: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;
};

type ChatStoreInventoryAPI = {
  setSessionMetas: (metas: SessionMeta[]) => void;
  mergeSessionPreviewOverlay: (sessionKey: string, overlay: SessionPreviewOverlay) => void;
  clearSessionPreviewOverlay: (sessionKey: string) => void;
  sessionPreviewOverlays: Record<string, SessionPreviewOverlay | undefined>;
};

type ChatStoreSessionAPI = {
  ensureSession: (key: string) => void;
  setMessages: (sessionKey: string, messages: ReturnType<typeof normalizeHistoryMessages>) => void;
  setActiveApproval: (sessionKey: string, approval: ApprovalRequest | null) => void;
  setA2UIState: (sessionKey: string, patch: Record<string, unknown> | null) => void;
  updateSessionState: (
    sessionKey: string,
    patch: {
      status?: "running" | "done" | "failed" | "killed" | "timeout";
      startedAt?: number;
      endedAt?: number;
      runtimeMs?: number;
      fastMode?: boolean;
    },
  ) => void;
  sessions: Map<
    string,
    {
      messages: ReturnType<typeof normalizeHistoryMessages>;
    }
  >;
};

function toSessionMeta(
  session: NonNullable<DeckGoSessionsListResponse["sessions"]>[number],
): SessionMeta {
  return {
    key: session.key,
    agentId: session.agentId ?? "main",
    title: session.title,
    updatedAt: session.updatedAt ?? Date.now(),
    lastMessagePreview: session.lastMessagePreview,
    status: session.status,
    model: session.model,
    modelProvider: session.modelProvider,
  };
}

export function syncChatHostSelection(
  store: ChatStoreSelectionAPI,
  params: { sessionKey: string; agentId: string },
) {
  const nextSessionKey = params.sessionKey.trim() || null;
  const nextAgentId = params.agentId.trim() || null;
  store.setActiveSession(nextSessionKey);
  store.setActiveAgent(nextAgentId);
}

export function syncChatHostInventory(
  store: ChatStoreInventoryAPI,
  sessions: DeckGoSessionsListResponse | null,
  previews: DeckGoSessionsPreviewResponse | null,
) {
  const metas = (sessions?.sessions ?? []).map(toSessionMeta);
  store.setSessionMetas(metas);

  for (const preview of previews?.previews ?? []) {
    const text = preview.items?.map((item) => item.text).join(" · ") || "";
    if (text) {
      store.mergeSessionPreviewOverlay(preview.key, {
        text,
        updatedAt: previews?.ts ?? Date.now(),
        source: "remote",
      });
      continue;
    }
    if (store.sessionPreviewOverlays[preview.key]?.source === "remote") {
      store.clearSessionPreviewOverlay(preview.key);
    }
  }
}

export function syncChatHostSelectedSession(
  store: ChatStoreSessionAPI,
  params: {
    sessionKey: string;
    agentId: string;
    sessionDetail: DeckGoSessionDetailResponse | null;
    snapshot: DeckGoChatSnapshotResponse | null;
    history: DeckGoChatHistoryResponse | null;
  },
) {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return;
  }

  const rawMessages =
    params.sessionDetail?.messages ?? params.snapshot?.messages ?? params.history?.messages ?? [];
  const normalized = normalizeHistoryMessages(sessionKey, rawMessages);

  store.ensureSession(sessionKey);
  const currentMessages = store.sessions.get(sessionKey)?.messages ?? [];
  if (!(normalized.length === 0 && currentMessages.length > 0)) {
    store.setMessages(sessionKey, normalized);
  }

  store.setActiveApproval(
    sessionKey,
    (params.snapshot?.activeApproval ??
      params.sessionDetail?.activeApproval ??
      null) as ApprovalRequest | null,
  );
  store.setA2UIState(
    sessionKey,
    params.snapshot?.a2uiState ?? params.sessionDetail?.a2uiState ?? null,
  );

  const meta = params.snapshot?.session ?? params.sessionDetail?.session ?? null;
  if (!meta) {
    return;
  }

  store.updateSessionState(sessionKey, {
    status:
      meta.status === "running" ||
      meta.status === "done" ||
      meta.status === "failed" ||
      meta.status === "killed" ||
      meta.status === "timeout"
        ? meta.status
        : undefined,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    runtimeMs: meta.runtimeMs,
  });
}
