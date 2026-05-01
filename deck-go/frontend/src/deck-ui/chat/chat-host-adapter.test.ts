import { beforeEach, describe, expect, it } from "vitest";
import type {
  DeckGoChatHistoryResponse,
  DeckGoChatSnapshotResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { useChatStore } from "../../stores/chat";
import {
  syncChatHostInventory,
  syncChatHostSelectedSession,
  syncChatHostSelection,
} from "./chat-host-adapter";

describe("chat-host-adapter", () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: new Map(),
      activeSessionKey: null,
      activeAgentId: null,
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
    });
  });

  it("syncs controller selection into the chat store", () => {
    syncChatHostSelection(useChatStore.getState(), {
      sessionKey: "sess-1",
      agentId: "main",
    });

    expect(useChatStore.getState().activeSessionKey).toBe("sess-1");
    expect(useChatStore.getState().activeAgentId).toBe("main");
  });

  it("maps sessions and preview overlays into the chat store", () => {
    const sessions: DeckGoSessionsListResponse = {
      sessions: [
        {
          key: "sess-1",
          agentId: "main",
          title: "Session 1",
          updatedAt: 1,
          status: "running",
          model: "gpt-5.4",
          modelProvider: "openai",
        },
      ],
    };
    const previews: DeckGoSessionsPreviewResponse = {
      ts: 123,
      previews: [
        { key: "sess-1", status: "ok", items: [{ role: "assistant", text: "preview text" }] },
      ],
    };

    syncChatHostInventory(useChatStore.getState(), sessions, previews);

    expect(useChatStore.getState().sessionMetas).toEqual([
      {
        key: "sess-1",
        agentId: "main",
        title: "Session 1",
        updatedAt: 1,
        lastMessagePreview: undefined,
        status: "running",
        model: "gpt-5.4",
        modelProvider: "openai",
      },
    ]);
    expect(useChatStore.getState().sessionPreviewOverlays["sess-1"]).toEqual({
      text: "preview text",
      updatedAt: 123,
      source: "remote",
    });
  });

  it("clears stale remote overlays when preview sync returns empty items", () => {
    useChatStore.getState().mergeSessionPreviewOverlay("sess-1", {
      text: "stale",
      updatedAt: 1,
      source: "remote",
    });

    syncChatHostInventory(
      useChatStore.getState(),
      {
        sessions: [{ key: "sess-1", agentId: "main", updatedAt: 1 }],
      },
      {
        previews: [{ key: "sess-1", status: "empty", items: [] }],
      },
    );

    expect(useChatStore.getState().sessionPreviewOverlays["sess-1"]).toBeUndefined();
  });

  it("syncs selected session transcript, approval, a2ui state, and lifecycle metadata", () => {
    const sessionDetail: DeckGoSessionDetailResponse = {
      session: {
        key: "sess-1",
        agentId: "main",
        title: "Session 1",
        updatedAt: 1,
        status: "running",
        startedAt: 10,
        endedAt: 20,
        runtimeMs: 10,
      },
      messages: [{ id: "msg-1", role: "assistant", content: [{ type: "text", text: "hi" }] }],
      activeApproval: {
        id: "approval-1",
        request: { command: "exec" },
        createdAtMs: 0,
        expiresAtMs: 0,
      },
      a2uiState: { visible: true, surfaces: ["summary"] },
    };

    syncChatHostSelectedSession(useChatStore.getState(), {
      sessionKey: "sess-1",
      agentId: "main",
      sessionDetail,
      snapshot: null,
      history: null,
    });

    const session = useChatStore.getState().sessions.get("sess-1");
    expect(session?.messages).toHaveLength(1);
    expect(session?.activeApproval).toEqual({
      id: "approval-1",
      request: { command: "exec" },
      createdAtMs: 0,
      expiresAtMs: 0,
    });
    expect(session?.a2uiState).toEqual({ visible: true, surfaces: ["summary"] });
    expect(session?.status).toBe("running");
    expect(session?.startedAt).toBe(10);
    expect(session?.endedAt).toBe(20);
    expect(session?.runtimeMs).toBe(10);
  });

  it("does not wipe local messages when host transcript sync is empty", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.addMessage("sess-1", {
      id: "local-msg",
      role: "assistant",
      content: [{ type: "text", text: "keep me" }],
      timestamp: 1,
    });

    const history: DeckGoChatHistoryResponse = { messages: [] };

    syncChatHostSelectedSession(store, {
      sessionKey: "sess-1",
      agentId: "main",
      sessionDetail: null,
      snapshot: null,
      history,
    });

    expect(useChatStore.getState().sessions.get("sess-1")?.messages).toEqual([
      {
        id: "local-msg",
        role: "assistant",
        content: [{ type: "text", text: "keep me" }],
        timestamp: 1,
      },
    ]);
  });

  it("prefers snapshot messages over history when both are present", () => {
    const snapshot: DeckGoChatSnapshotResponse = {
      session: {
        key: "sess-1",
        agentId: "main",
        title: "Session 1",
        updatedAt: 1,
        status: "done",
      },
      messages: [
        { id: "snap-1", role: "assistant", content: [{ type: "text", text: "from snapshot" }] },
      ],
      activeApproval: null,
      a2uiState: null,
    };
    const history: DeckGoChatHistoryResponse = {
      messages: [
        { id: "hist-1", role: "assistant", content: [{ type: "text", text: "from history" }] },
      ],
    };

    syncChatHostSelectedSession(useChatStore.getState(), {
      sessionKey: "sess-1",
      agentId: "main",
      sessionDetail: null,
      snapshot,
      history,
    });

    expect(useChatStore.getState().sessions.get("sess-1")?.messages[0]?.content).toEqual([
      { type: "text", text: "from snapshot" },
    ]);
  });
});
